/**
 * Notification Service
 *
 * Service for managing and sending notifications to users.
 */

import { eq, and, lte, desc, sql, or, isNull } from 'drizzle-orm';
import {
  getDatabase,
  notifications,
  notificationPreferences,
  users,
  type Database,
} from '@minori/database';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationPreferences,
  NotificationTrigger,
  NotificationDeliveryResult,
} from '@minori/shared';
import { getNotificationTemplate, validateTemplateData, getDefaultPriority } from './templates';

/**
 * Configuration for the notification service.
 */
export interface NotificationServiceConfig {
  /** Maximum notifications per batch delivery */
  batchSize?: number;
  /** Retry attempts for failed deliveries */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelayMs?: number;
  /** LINE push message sender function */
  sendLinePush?: (
    lineUserId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) => Promise<{ success: boolean; messageId?: string; error?: string }>;
}

const DEFAULT_CONFIG: Required<Omit<NotificationServiceConfig, 'sendLinePush'>> = {
  batchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
};

/**
 * Service for managing notifications.
 */
export class NotificationService {
  private config: NotificationServiceConfig;
  private db: Database;

  constructor(config?: NotificationServiceConfig, db?: Database) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = db ?? getDatabase();
  }

  // ============================================
  // Notification Creation
  // ============================================

  /**
   * Creates a notification from a trigger event.
   *
   * @param trigger - The trigger event
   * @returns Created notifications
   */
  async createFromTrigger(trigger: NotificationTrigger): Promise<Notification[]> {
    const template = getNotificationTemplate(trigger.type);
    const validation = validateTemplateData(trigger.type, trigger.data);

    if (!validation.valid) {
      console.warn(
        `Notification trigger missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    const createdNotifications: Notification[] = [];
    const priority = trigger.priority ?? template.defaultPriority;

    // Determine target users
    const targetUserIds = trigger.targetUserIds ?? [];

    for (const userId of targetUserIds) {
      // Check user preferences
      const preferences = await this.getUserPreferences(userId);
      if (!preferences.enabled) continue;
      if (!this.shouldSendNotification(trigger.type, preferences)) continue;

      const insertedNotifications = await this.db
        .insert(notifications)
        .values({
          userId,
          cooperativeId: trigger.cooperativeId,
          type: trigger.type as NotificationType,
          priority: priority as NotificationPriority,
          title: template.titleKey,
          body: template.bodyKey,
          data: trigger.data,
          relatedEntityId: trigger.sourceId,
          relatedEntityType: trigger.sourceType,
          status: 'pending',
          scheduledAt: trigger.scheduledAt,
        })
        .returning();

      const notification = insertedNotifications[0];
      if (notification) {
        createdNotifications.push(this.mapToNotification(notification));
      }
    }

    return createdNotifications;
  }

  /**
   * Creates a single notification directly.
   */
  async createNotification(params: {
    userId: string;
    cooperativeId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    priority?: NotificationPriority;
    relatedEntityId?: string;
    relatedEntityType?: string;
    scheduledAt?: Date;
  }): Promise<Notification> {
    const insertedNotifications = await this.db
      .insert(notifications)
      .values({
        userId: params.userId,
        cooperativeId: params.cooperativeId,
        type: params.type,
        priority: params.priority ?? getDefaultPriority(params.type),
        title: params.title,
        body: params.body,
        data: params.data,
        relatedEntityId: params.relatedEntityId,
        relatedEntityType: params.relatedEntityType,
        status: 'pending',
        scheduledAt: params.scheduledAt,
      })
      .returning();

    const notification = insertedNotifications[0];
    if (!notification) {
      throw new Error('Failed to create notification');
    }

    return this.mapToNotification(notification);
  }

  // ============================================
  // Notification Delivery
  // ============================================

  /**
   * Sends pending notifications that are due.
   *
   * @returns Delivery results
   */
  async sendPendingNotifications(): Promise<NotificationDeliveryResult[]> {
    const now = new Date();
    const results: NotificationDeliveryResult[] = [];

    // Find pending notifications that are due
    const pendingNotifications = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.status, 'pending'),
          or(isNull(notifications.scheduledAt), lte(notifications.scheduledAt, now))
        )
      )
      .limit(this.config.batchSize ?? 100);

    // Send each notification
    for (const notification of pendingNotifications) {
      const result = await this.deliverNotification(this.mapToNotification(notification));
      results.push(result);
    }

    return results;
  }

  /**
   * Delivers a single notification.
   */
  async deliverNotification(notification: Notification): Promise<NotificationDeliveryResult> {
    try {
      // Increment delivery attempts
      await this.db
        .update(notifications)
        .set({
          deliveryAttempts: sql`${notifications.deliveryAttempts} + 1`,
        })
        .where(eq(notifications.id, notification.id));

      // Check if we have a LINE push function configured
      if (!this.config.sendLinePush) {
        // Simulate delivery for testing
        await this.db
          .update(notifications)
          .set({
            status: 'sent',
            sentAt: new Date(),
          })
          .where(eq(notifications.id, notification.id));

        return {
          notificationId: notification.id,
          success: true,
          deliveredAt: new Date(),
        };
      }

      // Get user's LINE ID
      const [user] = await this.db
        .select({ lineUserId: users.lineUserId })
        .from(users)
        .where(eq(users.id, notification.userId))
        .limit(1);

      if (!user) {
        await this.db
          .update(notifications)
          .set({
            status: 'failed',
            errorMessage: 'User not found',
          })
          .where(eq(notifications.id, notification.id));

        return {
          notificationId: notification.id,
          success: false,
          error: 'User not found',
        };
      }

      const result = await this.config.sendLinePush(
        user.lineUserId,
        notification.title,
        notification.body,
        notification.data
      );

      if (result.success) {
        await this.db
          .update(notifications)
          .set({
            status: 'sent',
            sentAt: new Date(),
            lineMessageId: result.messageId,
          })
          .where(eq(notifications.id, notification.id));

        return {
          notificationId: notification.id,
          success: true,
          lineMessageId: result.messageId,
          deliveredAt: new Date(),
        };
      } else {
        await this.db
          .update(notifications)
          .set({
            status: 'failed',
            errorMessage: result.error,
          })
          .where(eq(notifications.id, notification.id));

        return {
          notificationId: notification.id,
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.db
        .update(notifications)
        .set({
          status: 'failed',
          errorMessage,
        })
        .where(eq(notifications.id, notification.id));

      return {
        notificationId: notification.id,
        success: false,
        error: errorMessage,
      };
    }
  }

  // ============================================
  // Notification Queries
  // ============================================

  /**
   * Gets notifications for a user.
   */
  async getUserNotifications(
    userId: string,
    options: {
      status?: NotificationStatus;
      type?: NotificationType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Notification[]> {
    const { status, type, limit = 50, offset = 0 } = options;

    const conditions = [eq(notifications.userId, userId)];

    if (status) {
      conditions.push(eq(notifications.status, status));
    }
    if (type) {
      conditions.push(eq(notifications.type, type));
    }

    const results = await this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map((n) => this.mapToNotification(n));
  }

  /**
   * Gets a notification by ID.
   */
  async getNotificationById(id: string): Promise<Notification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!notification) return null;
    return this.mapToNotification(notification);
  }

  /**
   * Marks a notification as read.
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({
        status: 'read',
        readAt: new Date(),
      })
      .where(eq(notifications.id, notificationId))
      .returning({ id: notifications.id });

    return result.length > 0;
  }

  /**
   * Marks a notification as dismissed.
   */
  async markAsDismissed(notificationId: string): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({
        status: 'dismissed',
      })
      .where(eq(notifications.id, notificationId))
      .returning({ id: notifications.id });

    return result.length > 0;
  }

  /**
   * Gets unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.status, 'sent')));

    return result?.count ?? 0;
  }

  // ============================================
  // User Preferences
  // ============================================

  /**
   * Gets notification preferences for a user.
   * Returns default preferences if none exist.
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const [existing] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      return {
        userId: existing.userId,
        enabled: existing.enabled,
        quietHoursStart: existing.quietHoursStart ?? undefined,
        quietHoursEnd: existing.quietHoursEnd ?? undefined,
        timezone: existing.timezone,
        harvestReminders: existing.harvestReminders,
        harvestReminderDays: existing.harvestReminderDays,
        weatherAlerts: existing.weatherAlerts,
        priceAlerts: existing.priceAlerts,
        priceAlertThreshold: existing.priceAlertThreshold,
        demandNotifications: existing.demandNotifications,
        matchNotifications: existing.matchNotifications,
        cooperativeAnnouncements: existing.cooperativeAnnouncements,
        dailyDigest: existing.dailyDigest,
        digestTime: existing.digestTime ?? undefined,
        updatedAt: existing.updatedAt,
      };
    }

    // Return defaults
    return {
      userId,
      enabled: true,
      timezone: 'Asia/Taipei',
      harvestReminders: true,
      harvestReminderDays: 3,
      weatherAlerts: true,
      priceAlerts: true,
      priceAlertThreshold: 15,
      demandNotifications: true,
      matchNotifications: true,
      cooperativeAnnouncements: true,
      dailyDigest: false,
      updatedAt: new Date(),
    };
  }

  /**
   * Updates notification preferences for a user.
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>
  ): Promise<NotificationPreferences> {
    // Check if preferences exist
    const [existing] = await this.db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (!existing) {
      // Create new preferences
      await this.db.insert(notificationPreferences).values({
        userId,
        enabled: updates.enabled ?? true,
        quietHoursStart: updates.quietHoursStart,
        quietHoursEnd: updates.quietHoursEnd,
        timezone: updates.timezone ?? 'Asia/Taipei',
        harvestReminders: updates.harvestReminders ?? true,
        harvestReminderDays: updates.harvestReminderDays ?? 3,
        weatherAlerts: updates.weatherAlerts ?? true,
        priceAlerts: updates.priceAlerts ?? true,
        priceAlertThreshold: updates.priceAlertThreshold ?? 15,
        demandNotifications: updates.demandNotifications ?? true,
        matchNotifications: updates.matchNotifications ?? true,
        cooperativeAnnouncements: updates.cooperativeAnnouncements ?? true,
        dailyDigest: updates.dailyDigest ?? false,
        digestTime: updates.digestTime,
      });
    } else {
      // Update existing preferences
      await this.db
        .update(notificationPreferences)
        .set({
          enabled: updates.enabled,
          quietHoursStart: updates.quietHoursStart,
          quietHoursEnd: updates.quietHoursEnd,
          timezone: updates.timezone,
          harvestReminders: updates.harvestReminders,
          harvestReminderDays: updates.harvestReminderDays,
          weatherAlerts: updates.weatherAlerts,
          priceAlerts: updates.priceAlerts,
          priceAlertThreshold: updates.priceAlertThreshold,
          demandNotifications: updates.demandNotifications,
          matchNotifications: updates.matchNotifications,
          cooperativeAnnouncements: updates.cooperativeAnnouncements,
          dailyDigest: updates.dailyDigest,
          digestTime: updates.digestTime,
        })
        .where(eq(notificationPreferences.userId, userId));
    }

    return this.getUserPreferences(userId);
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a database notification record to the Notification type.
   */
  private mapToNotification(record: {
    id: string;
    userId: string;
    cooperativeId: string;
    type: string;
    priority: string;
    title: string;
    body: string;
    data: unknown;
    relatedEntityId: string | null;
    relatedEntityType: string | null;
    status: string;
    scheduledAt: Date | null;
    sentAt: Date | null;
    readAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Notification {
    return {
      id: record.id,
      userId: record.userId,
      cooperativeId: record.cooperativeId,
      type: record.type as NotificationType,
      priority: record.priority as NotificationPriority,
      title: record.title,
      body: record.body,
      data: record.data as Record<string, unknown> | undefined,
      relatedEntityId: record.relatedEntityId ?? undefined,
      relatedEntityType: record.relatedEntityType ?? undefined,
      status: record.status as NotificationStatus,
      scheduledAt: record.scheduledAt ?? undefined,
      sentAt: record.sentAt ?? undefined,
      readAt: record.readAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Checks if a notification type should be sent based on user preferences.
   */
  private shouldSendNotification(
    type: NotificationType,
    preferences: NotificationPreferences
  ): boolean {
    switch (type) {
      case 'harvest_reminder':
      case 'harvest_confirmed':
        return preferences.harvestReminders;

      case 'planting_confirmed':
      case 'planting_optimal':
        return preferences.harvestReminders; // Using same preference

      case 'weather_alert':
      case 'weather_forecast':
        return preferences.weatherAlerts;

      case 'price_alert':
      case 'price_opportunity':
        return preferences.priceAlerts;

      case 'demand_new':
      case 'demand_urgent':
        return preferences.demandNotifications;

      case 'match_found':
      case 'match_accepted':
      case 'match_rejected':
      case 'match_fulfilled':
        return preferences.matchNotifications;

      case 'cooperative_announcement':
        return preferences.cooperativeAnnouncements;

      case 'system':
        return true; // System notifications always sent

      default:
        return true;
    }
  }

  /**
   * Checks if current time is within quiet hours.
   */
  isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    // Simple check - in production would need proper timezone handling
    const currentTime =
      now.getHours().toString().padStart(2, '0') +
      ':' +
      now.getMinutes().toString().padStart(2, '0');

    const start = preferences.quietHoursStart;
    const end = preferences.quietHoursEnd;

    // Handle wrap-around (e.g., 22:00 to 07:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    } else {
      return currentTime >= start && currentTime < end;
    }
  }
}

/**
 * Factory function to create a notification service.
 */
export function createNotificationService(
  config?: NotificationServiceConfig,
  db?: Database
): NotificationService {
  return new NotificationService(config, db);
}
