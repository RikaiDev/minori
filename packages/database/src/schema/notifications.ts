/**
 * Notification Schema
 *
 * Tables for the notification and reminder system.
 */

import {
  pgTable,
  text,
  timestamp,
  varchar,
  index,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { cooperatives } from './cooperatives';
import { createId } from '../utils';

/**
 * Notification type enum.
 */
export const notificationTypeEnum = pgEnum('notification_type', [
  'harvest_reminder',
  'harvest_confirmed',
  'planting_confirmed',
  'planting_optimal',
  'weather_alert',
  'weather_forecast',
  'price_alert',
  'price_opportunity',
  'demand_new',
  'demand_urgent',
  'match_found',
  'match_accepted',
  'match_rejected',
  'match_fulfilled',
  'cooperative_announcement',
  'system',
]);

/**
 * Notification priority enum.
 */
export const notificationPriorityEnum = pgEnum('notification_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

/**
 * Notification status enum.
 */
export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sent',
  'failed',
  'read',
  'dismissed',
]);

/**
 * Notifications table - stores all notifications sent to users.
 */
export const notifications = pgTable(
  'notifications',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** User ID to receive the notification */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Cooperative ID for tenant context */
    cooperativeId: text('cooperative_id')
      .notNull()
      .references(() => cooperatives.id, { onDelete: 'cascade' }),

    /** Type of notification */
    type: notificationTypeEnum('type').notNull(),

    /** Priority level */
    priority: notificationPriorityEnum('priority').notNull().default('medium'),

    /** Notification title */
    title: text('title').notNull(),

    /** Notification body */
    body: text('body').notNull(),

    /** Additional data payload (JSON) */
    data: jsonb('data'),

    /** Related entity ID */
    relatedEntityId: text('related_entity_id'),

    /** Related entity type */
    relatedEntityType: varchar('related_entity_type', { length: 50 }),

    /** Current status */
    status: notificationStatusEnum('status').notNull().default('pending'),

    /** Scheduled send time */
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),

    /** When the notification was sent */
    sentAt: timestamp('sent_at', { withTimezone: true }),

    /** When the notification was read */
    readAt: timestamp('read_at', { withTimezone: true }),

    /** LINE message ID if sent via LINE */
    lineMessageId: varchar('line_message_id', { length: 100 }),

    /** Error message if delivery failed */
    errorMessage: text('error_message'),

    /** Number of delivery attempts */
    deliveryAttempts: integer('delivery_attempts').notNull().default(0),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_cooperative_id_idx').on(table.cooperativeId),
    index('notifications_type_idx').on(table.type),
    index('notifications_status_idx').on(table.status),
    index('notifications_scheduled_at_idx').on(table.scheduledAt),
    index('notifications_created_at_idx').on(table.createdAt),
  ]
);

/**
 * Notification preferences table - stores user preferences for notifications.
 */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** User ID (unique constraint) */
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Global notification toggle */
    enabled: boolean('enabled').notNull().default(true),

    /** Quiet hours start (HH:mm format) */
    quietHoursStart: varchar('quiet_hours_start', { length: 5 }),

    /** Quiet hours end (HH:mm format) */
    quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),

    /** Timezone for quiet hours */
    timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Taipei'),

    /** Harvest reminders enabled */
    harvestReminders: boolean('harvest_reminders').notNull().default(true),

    /** Days before harvest to send reminder */
    harvestReminderDays: integer('harvest_reminder_days').notNull().default(3),

    /** Weather alerts enabled */
    weatherAlerts: boolean('weather_alerts').notNull().default(true),

    /** Price alerts enabled */
    priceAlerts: boolean('price_alerts').notNull().default(true),

    /** Price change threshold percentage for alerts */
    priceAlertThreshold: integer('price_alert_threshold').notNull().default(15),

    /** Demand notifications enabled */
    demandNotifications: boolean('demand_notifications').notNull().default(true),

    /** Match notifications enabled */
    matchNotifications: boolean('match_notifications').notNull().default(true),

    /** Cooperative announcements enabled */
    cooperativeAnnouncements: boolean('cooperative_announcements').notNull().default(true),

    /** Use daily digest instead of immediate notifications */
    dailyDigest: boolean('daily_digest').notNull().default(false),

    /** Preferred time for daily digest (HH:mm format) */
    digestTime: varchar('digest_time', { length: 5 }),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('notification_preferences_user_id_idx').on(table.userId)]
);

/**
 * Notification schedules table - defines scheduled jobs for notifications.
 */
export const notificationSchedules = pgTable(
  'notification_schedules',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Job name */
    name: varchar('name', { length: 100 }).notNull(),

    /** Cron expression */
    cronExpression: varchar('cron_expression', { length: 50 }).notNull(),

    /** Notification type to check/send */
    type: notificationTypeEnum('type').notNull(),

    /** Whether the job is active */
    isActive: boolean('is_active').notNull().default(true),

    /** Configuration options (JSON) */
    config: jsonb('config'),

    /** Last run timestamp */
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),

    /** Last run status */
    lastRunStatus: varchar('last_run_status', { length: 20 }),

    /** Next scheduled run */
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('notification_schedules_type_idx').on(table.type),
    index('notification_schedules_is_active_idx').on(table.isActive),
    index('notification_schedules_next_run_at_idx').on(table.nextRunAt),
  ]
);

export type NotificationRecord = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type NotificationPreferencesRecord = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert;

export type NotificationScheduleRecord = typeof notificationSchedules.$inferSelect;
export type NewNotificationSchedule = typeof notificationSchedules.$inferInsert;
