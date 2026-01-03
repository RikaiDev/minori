/**
 * Integration tests for Notification Service
 *
 * These tests require a database connection (DATABASE_URL).
 * They are skipped when running without a database.
 */

import { describe, expect, test } from 'bun:test';
import { NotificationService, createNotificationService } from './notification-service';
import type { NotificationPreferences } from '@minori/shared';

// Skip integration tests when DATABASE_URL is not available
const SKIP_INTEGRATION = !process.env.DATABASE_URL;
const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

describeIntegration('NotificationService', () => {
  describe('createNotificationService', () => {
    test('creates a notification service instance', () => {
      const service = createNotificationService();
      expect(service).toBeInstanceOf(NotificationService);
    });

    test('creates service with custom config', () => {
      const service = createNotificationService({
        batchSize: 50,
        maxRetries: 5,
      });
      expect(service).toBeInstanceOf(NotificationService);
    });
  });

  describe('createNotification', () => {
    test('creates a notification with all required fields', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_123',
        cooperativeId: 'coop_456',
        type: 'harvest_reminder',
        title: 'Harvest Soon',
        body: 'Your bok choy is ready',
        data: { cropName: 'Bok Choy', daysUntilHarvest: 3 },
      });

      expect(notification.id).toMatch(/^notif_/);
      expect(notification.userId).toBe('user_123');
      expect(notification.cooperativeId).toBe('coop_456');
      expect(notification.type).toBe('harvest_reminder');
      expect(notification.title).toBe('Harvest Soon');
      expect(notification.body).toBe('Your bok choy is ready');
      expect(notification.status).toBe('pending');
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    test('creates notification with default priority', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_123',
        cooperativeId: 'coop_456',
        type: 'weather_alert',
        title: 'Weather Alert',
        body: 'Typhoon warning',
      });

      expect(notification.priority).toBe('urgent');
    });

    test('creates notification with custom priority', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_123',
        cooperativeId: 'coop_456',
        type: 'system',
        title: 'System Message',
        body: 'Test message',
        priority: 'high',
      });

      expect(notification.priority).toBe('high');
    });

    test('creates notification with related entity', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_123',
        cooperativeId: 'coop_456',
        type: 'harvest_reminder',
        title: 'Harvest Reminder',
        body: 'Check your crops',
        relatedEntityId: 'planting_789',
        relatedEntityType: 'planting_record',
      });

      expect(notification.relatedEntityId).toBe('planting_789');
      expect(notification.relatedEntityType).toBe('planting_record');
    });
  });

  describe('deliverNotification', () => {
    test('delivers notification without LINE push configured (simulation)', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_123',
        cooperativeId: 'coop_456',
        type: 'system',
        title: 'Test',
        body: 'Test message',
      });

      const result = await service.deliverNotification(notification);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe(notification.id);
      expect(notification.status).toBe('sent');
      expect(notification.sentAt).toBeInstanceOf(Date);
    });

    test('delivers notification with custom LINE push function', async () => {
      let pushedData: {
        lineUserId: string;
        title: string;
        body: string;
        data?: Record<string, unknown>;
      } | null = null;

      const service = createNotificationService({
        sendLinePush: async (lineUserId, title, body, data) => {
          pushedData = { lineUserId, title, body, data };
          return { success: true, messageId: 'msg_123' };
        },
      });

      const notification = await service.createNotification({
        userId: 'user_456',
        cooperativeId: 'coop_789',
        type: 'price_alert',
        title: 'Price Alert',
        body: 'Tomato price increased',
        data: { cropName: 'Tomato', changePercent: 15 },
      });

      const result = await service.deliverNotification(notification);

      expect(result.success).toBe(true);
      expect(result.lineMessageId).toBe('msg_123');
      expect(pushedData).not.toBeNull();
      expect(pushedData!.lineUserId).toBe('LINE_user_456');
      expect(pushedData!.title).toBe('Price Alert');
    });

    test('handles delivery failure', async () => {
      const service = createNotificationService({
        sendLinePush: async () => {
          return { success: false, error: 'User blocked bot' };
        },
      });

      const notification = await service.createNotification({
        userId: 'user_blocked',
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Test',
        body: 'Test message',
      });

      const result = await service.deliverNotification(notification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User blocked bot');
      expect(notification.status).toBe('failed');
    });

    test('handles delivery exception', async () => {
      const service = createNotificationService({
        sendLinePush: async () => {
          throw new Error('Network error');
        },
      });

      const notification = await service.createNotification({
        userId: 'user_123',
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Test',
        body: 'Test message',
      });

      const result = await service.deliverNotification(notification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(notification.status).toBe('failed');
    });
  });

  describe('getUserNotifications', () => {
    test('returns notifications for a user', async () => {
      const service = createNotificationService();

      // Create some notifications
      await service.createNotification({
        userId: 'user_query_test',
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Notification 1',
        body: 'Body 1',
      });
      await service.createNotification({
        userId: 'user_query_test',
        cooperativeId: 'coop_123',
        type: 'harvest_reminder',
        title: 'Notification 2',
        body: 'Body 2',
      });
      await service.createNotification({
        userId: 'other_user',
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Other User Notification',
        body: 'Not for user_query_test',
      });

      const notifications = await service.getUserNotifications('user_query_test');

      expect(notifications.length).toBeGreaterThanOrEqual(2);
      expect(notifications.every((n) => n.userId === 'user_query_test')).toBe(true);
    });

    test('filters notifications by status', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_status_test',
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Pending Notification',
        body: 'Body',
      });

      await service.deliverNotification(notification);

      const pending = await service.getUserNotifications('user_status_test', {
        status: 'pending',
      });
      const sent = await service.getUserNotifications('user_status_test', {
        status: 'sent',
      });

      expect(sent.some((n) => n.id === notification.id)).toBe(true);
      expect(pending.some((n) => n.id === notification.id)).toBe(false);
    });

    test('filters notifications by type', async () => {
      const service = createNotificationService();

      await service.createNotification({
        userId: 'user_type_test',
        cooperativeId: 'coop_123',
        type: 'weather_alert',
        title: 'Weather Alert',
        body: 'Storm warning',
      });

      const weatherAlerts = await service.getUserNotifications('user_type_test', {
        type: 'weather_alert',
      });

      expect(weatherAlerts.every((n) => n.type === 'weather_alert')).toBe(true);
    });
  });

  describe('markAsRead', () => {
    test('marks notification as read', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_read_test',
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Test',
        body: 'Body',
      });

      const result = await service.markAsRead(notification.id);
      const updated = await service.getNotificationById(notification.id);

      expect(result).toBe(true);
      expect(updated?.status).toBe('read');
      expect(updated?.readAt).toBeInstanceOf(Date);
    });

    test('returns false for non-existent notification', async () => {
      const service = createNotificationService();
      const result = await service.markAsRead('non_existent_id');
      expect(result).toBe(false);
    });
  });

  describe('markAsDismissed', () => {
    test('marks notification as dismissed', async () => {
      const service = createNotificationService();

      const notification = await service.createNotification({
        userId: 'user_dismiss_test',
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Test',
        body: 'Body',
      });

      const result = await service.markAsDismissed(notification.id);
      const updated = await service.getNotificationById(notification.id);

      expect(result).toBe(true);
      expect(updated?.status).toBe('dismissed');
    });
  });

  describe('getUserPreferences', () => {
    test('returns default preferences for new user', async () => {
      const service = createNotificationService();

      const preferences = await service.getUserPreferences('new_user_prefs');

      expect(preferences.userId).toBe('new_user_prefs');
      expect(preferences.enabled).toBe(true);
      expect(preferences.timezone).toBe('Asia/Taipei');
      expect(preferences.harvestReminders).toBe(true);
      expect(preferences.harvestReminderDays).toBe(3);
      expect(preferences.weatherAlerts).toBe(true);
      expect(preferences.priceAlerts).toBe(true);
      expect(preferences.priceAlertThreshold).toBe(15);
    });
  });

  describe('updateUserPreferences', () => {
    test('updates user preferences', async () => {
      const service = createNotificationService();

      const updated = await service.updateUserPreferences('user_prefs_update', {
        enabled: false,
        harvestReminderDays: 7,
        priceAlertThreshold: 20,
      });

      expect(updated.userId).toBe('user_prefs_update');
      expect(updated.enabled).toBe(false);
      expect(updated.harvestReminderDays).toBe(7);
      expect(updated.priceAlertThreshold).toBe(20);
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    test('preserves existing preferences when updating', async () => {
      const service = createNotificationService();

      // First update
      await service.updateUserPreferences('user_prefs_preserve', {
        harvestReminders: false,
      });

      // Second update
      const updated = await service.updateUserPreferences('user_prefs_preserve', {
        weatherAlerts: false,
      });

      expect(updated.harvestReminders).toBe(false);
      expect(updated.weatherAlerts).toBe(false);
    });
  });

  describe('getUnreadCount', () => {
    test('counts unread notifications', async () => {
      const service = createNotificationService();
      const userId = 'user_unread_count';

      // Create and deliver notifications
      const notif1 = await service.createNotification({
        userId,
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Notification 1',
        body: 'Body 1',
      });
      const notif2 = await service.createNotification({
        userId,
        cooperativeId: 'coop_123',
        type: 'system',
        title: 'Notification 2',
        body: 'Body 2',
      });

      await service.deliverNotification(notif1);
      await service.deliverNotification(notif2);

      const count = await service.getUnreadCount(userId);
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isQuietHours', () => {
    test('returns false when no quiet hours configured', () => {
      const service = createNotificationService();

      const preferences: NotificationPreferences = {
        userId: 'test',
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

      expect(service.isQuietHours(preferences)).toBe(false);
    });

    test('detects quiet hours correctly', () => {
      const service = createNotificationService();

      const now = new Date();
      const currentHour = now.getHours();

      // Set quiet hours to include current time (1 hour before to 1 hour after)
      const quietStart =
        (currentHour - 1 >= 0 ? currentHour - 1 : 23).toString().padStart(2, '0') + ':00';
      const quietEnd = ((currentHour + 1) % 24).toString().padStart(2, '0') + ':00';

      const preferences: NotificationPreferences = {
        userId: 'test',
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
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
        updatedAt: new Date(),
      };

      expect(service.isQuietHours(preferences)).toBe(true);
    });
  });
});
