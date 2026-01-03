/**
 * Notification Service
 *
 * Service for managing and sending notifications to users.
 */

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
 * Mock storage for notifications.
 * TODO: Replace with database operations.
 */
const MOCK_NOTIFICATIONS: Map<string, Notification> = new Map();
const MOCK_PREFERENCES: Map<string, NotificationPreferences> = new Map();

let notificationIdCounter = 1;
function generateId(): string {
  return `notif_${Date.now()}_${notificationIdCounter++}`;
}

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

  constructor(config?: NotificationServiceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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

    const notifications: Notification[] = [];
    const now = new Date();
    const priority = trigger.priority ?? template.defaultPriority;

    // Determine target users
    const targetUserIds = trigger.targetUserIds ?? [];

    for (const userId of targetUserIds) {
      // Check user preferences
      const preferences = await this.getUserPreferences(userId);
      if (!preferences.enabled) continue;
      if (!this.shouldSendNotification(trigger.type, preferences)) continue;

      const notification: Notification = {
        id: generateId(),
        userId,
        cooperativeId: trigger.cooperativeId,
        type: trigger.type,
        priority,
        title: template.titleKey,
        body: template.bodyKey,
        data: trigger.data,
        relatedEntityId: trigger.sourceId,
        relatedEntityType: trigger.sourceType,
        status: 'pending',
        scheduledAt: trigger.scheduledAt,
        createdAt: now,
        updatedAt: now,
      };

      MOCK_NOTIFICATIONS.set(notification.id, notification);
      notifications.push(notification);
    }

    return notifications;
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
    const now = new Date();
    const notification: Notification = {
      id: generateId(),
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
      createdAt: now,
      updatedAt: now,
    };

    MOCK_NOTIFICATIONS.set(notification.id, notification);
    return notification;
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
    const pendingNotifications: Notification[] = [];

    // Find pending notifications that are due
    for (const notification of MOCK_NOTIFICATIONS.values()) {
      if (notification.status !== 'pending') continue;

      // Check if scheduled time has passed (or no schedule = immediate)
      if (notification.scheduledAt && notification.scheduledAt > now) continue;

      pendingNotifications.push(notification);
      if (pendingNotifications.length >= (this.config.batchSize ?? 100)) break;
    }

    // Send each notification
    for (const notification of pendingNotifications) {
      const result = await this.deliverNotification(notification);
      results.push(result);
    }

    return results;
  }

  /**
   * Delivers a single notification.
   */
  async deliverNotification(notification: Notification): Promise<NotificationDeliveryResult> {
    try {
      // Check if we have a LINE push function configured
      if (!this.config.sendLinePush) {
        // Simulate delivery for testing
        notification.status = 'sent';
        notification.sentAt = new Date();
        notification.updatedAt = new Date();

        return {
          notificationId: notification.id,
          success: true,
          deliveredAt: notification.sentAt,
        };
      }

      // Get user's LINE ID (would need database lookup in production)
      // For now, we'll use a mock
      const lineUserId = `LINE_${notification.userId}`;

      const result = await this.config.sendLinePush(
        lineUserId,
        notification.title,
        notification.body,
        notification.data
      );

      if (result.success) {
        notification.status = 'sent';
        notification.sentAt = new Date();
        notification.updatedAt = new Date();

        return {
          notificationId: notification.id,
          success: true,
          lineMessageId: result.messageId,
          deliveredAt: notification.sentAt,
        };
      } else {
        notification.status = 'failed';
        notification.updatedAt = new Date();

        return {
          notificationId: notification.id,
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      notification.status = 'failed';
      notification.updatedAt = new Date();

      return {
        notificationId: notification.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
    const notifications: Notification[] = [];

    for (const notification of MOCK_NOTIFICATIONS.values()) {
      if (notification.userId !== userId) continue;
      if (status && notification.status !== status) continue;
      if (type && notification.type !== type) continue;

      notifications.push(notification);
    }

    // Sort by createdAt descending
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return notifications.slice(offset, offset + limit);
  }

  /**
   * Gets a notification by ID.
   */
  async getNotificationById(id: string): Promise<Notification | null> {
    return MOCK_NOTIFICATIONS.get(id) ?? null;
  }

  /**
   * Marks a notification as read.
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const notification = MOCK_NOTIFICATIONS.get(notificationId);
    if (!notification) return false;

    notification.status = 'read';
    notification.readAt = new Date();
    notification.updatedAt = new Date();

    return true;
  }

  /**
   * Marks a notification as dismissed.
   */
  async markAsDismissed(notificationId: string): Promise<boolean> {
    const notification = MOCK_NOTIFICATIONS.get(notificationId);
    if (!notification) return false;

    notification.status = 'dismissed';
    notification.updatedAt = new Date();

    return true;
  }

  /**
   * Gets unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    let count = 0;
    for (const notification of MOCK_NOTIFICATIONS.values()) {
      if (notification.userId === userId && notification.status === 'sent') {
        count++;
      }
    }
    return count;
  }

  // ============================================
  // User Preferences
  // ============================================

  /**
   * Gets notification preferences for a user.
   * Returns default preferences if none exist.
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const existing = MOCK_PREFERENCES.get(userId);
    if (existing) return existing;

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
    const existing = await this.getUserPreferences(userId);
    const updated: NotificationPreferences = {
      ...existing,
      ...updates,
      userId,
      updatedAt: new Date(),
    };

    MOCK_PREFERENCES.set(userId, updated);
    return updated;
  }

  // ============================================
  // Helper Methods
  // ============================================

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
export function createNotificationService(config?: NotificationServiceConfig): NotificationService {
  return new NotificationService(config);
}
