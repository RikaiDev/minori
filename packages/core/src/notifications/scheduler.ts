/**
 * Notification Scheduler
 *
 * Manages scheduled notification jobs for harvest reminders,
 * price alerts, and weather notifications.
 */

import type { NotificationType, NotificationSchedule, TaiwanRegion } from '@minori/shared';
import type { NotificationService } from './notification-service';

/**
 * Job handler function type.
 */
export type ScheduledJobHandler = () => Promise<{ processed: number; sent: number }>;

/**
 * Scheduled job definition.
 */
interface ScheduledJob {
  schedule: NotificationSchedule;
  handler: ScheduledJobHandler;
  timer?: ReturnType<typeof setInterval>;
}

/**
 * Default schedules for notification jobs.
 */
export const DEFAULT_SCHEDULES: NotificationSchedule[] = [
  {
    id: 'harvest_reminder_daily',
    name: 'Daily Harvest Reminders',
    cronExpression: '0 8 * * *', // 8:00 AM daily
    notificationType: 'harvest_reminder',
    isActive: true,
  },
  {
    id: 'weather_alert_check',
    name: 'Weather Alert Check',
    cronExpression: '0 */4 * * *', // Every 4 hours
    notificationType: 'weather_alert',
    isActive: true,
  },
  {
    id: 'price_alert_daily',
    name: 'Daily Price Alerts',
    cronExpression: '0 9 * * *', // 9:00 AM daily
    notificationType: 'price_alert',
    isActive: true,
  },
  {
    id: 'daily_digest',
    name: 'Daily Digest',
    cronExpression: '0 18 * * *', // 6:00 PM daily
    notificationType: 'system',
    isActive: true,
  },
];

/**
 * Configuration for the notification scheduler.
 */
export interface NotificationSchedulerConfig {
  /** Whether to start jobs automatically */
  autoStart?: boolean;
  /** Custom schedules to use instead of defaults */
  schedules?: NotificationSchedule[];
  /** Notification service instance */
  notificationService: NotificationService;
  /** Data provider functions */
  dataProviders?: {
    getUpcomingHarvests?: () => Promise<
      Array<{
        userId: string;
        cooperativeId: string;
        cropName: string;
        expectedHarvestDate: Date;
        plantingRecordId: string;
      }>
    >;
    getWeatherAlerts?: (region: TaiwanRegion) => Promise<
      Array<{
        alertType: string;
        severity: string;
        description: string;
        affectedAreas: string[];
      }>
    >;
    getPriceChanges?: () => Promise<
      Array<{
        cropId: string;
        cropName: string;
        currentPrice: number;
        changePercent: number;
        trend: 'up' | 'down' | 'stable';
      }>
    >;
    getUsersForCrop?: (cropId: string) => Promise<
      Array<{
        userId: string;
        cooperativeId: string;
      }>
    >;
    getUsersInRegion?: (region: TaiwanRegion) => Promise<
      Array<{
        userId: string;
        cooperativeId: string;
      }>
    >;
  };
}

/**
 * Scheduler for managing notification jobs.
 */
export class NotificationScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private notificationService: NotificationService;
  private config: NotificationSchedulerConfig;
  private isRunning = false;

  constructor(config: NotificationSchedulerConfig) {
    this.config = config;
    this.notificationService = config.notificationService;

    // Initialize jobs from schedules
    const schedules = config.schedules ?? DEFAULT_SCHEDULES;
    for (const schedule of schedules) {
      this.registerJob(schedule);
    }
  }

  /**
   * Registers a scheduled job.
   */
  registerJob(schedule: NotificationSchedule): void {
    const handler = this.createHandler(schedule.notificationType);
    this.jobs.set(schedule.id, { schedule, handler });
  }

  /**
   * Starts all active scheduled jobs.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    for (const [id, job] of this.jobs.entries()) {
      if (!job.schedule.isActive) continue;

      // Parse cron expression to get interval
      const intervalMs = this.cronToInterval(job.schedule.cronExpression);

      // Start the job timer
      job.timer = setInterval(async () => {
        console.log(`Running scheduled job: ${job.schedule.name}`);
        try {
          const result = await job.handler();
          job.schedule.lastRunAt = new Date();
          job.schedule.lastRunStatus = 'success';
          console.log(`Job ${id} completed: ${result.sent}/${result.processed} notifications sent`);
        } catch (error) {
          job.schedule.lastRunStatus = 'failed';
          console.error(`Job ${id} failed:`, error);
        }
      }, intervalMs);

      console.log(`Started job: ${job.schedule.name} (every ${intervalMs / 1000}s)`);
    }
  }

  /**
   * Stops all scheduled jobs.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearInterval(job.timer);
        job.timer = undefined;
      }
    }

    console.log('All scheduled jobs stopped');
  }

  /**
   * Runs a specific job immediately.
   */
  async runJob(jobId: string): Promise<{ processed: number; sent: number }> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const result = await job.handler();
    job.schedule.lastRunAt = new Date();
    job.schedule.lastRunStatus = 'success';

    return result;
  }

  /**
   * Gets all registered jobs.
   */
  getJobs(): NotificationSchedule[] {
    return Array.from(this.jobs.values()).map((j) => j.schedule);
  }

  /**
   * Updates a job's active status.
   */
  setJobActive(jobId: string, isActive: boolean): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.schedule.isActive = isActive;

    if (isActive && this.isRunning && !job.timer) {
      // Start the job
      const intervalMs = this.cronToInterval(job.schedule.cronExpression);
      job.timer = setInterval(async () => {
        await job.handler();
      }, intervalMs);
    } else if (!isActive && job.timer) {
      // Stop the job
      clearInterval(job.timer);
      job.timer = undefined;
    }
  }

  // ============================================
  // Job Handlers
  // ============================================

  /**
   * Creates a handler for a notification type.
   */
  private createHandler(type: NotificationType): ScheduledJobHandler {
    switch (type) {
      case 'harvest_reminder':
        return this.createHarvestReminderHandler();
      case 'weather_alert':
        return this.createWeatherAlertHandler();
      case 'price_alert':
        return this.createPriceAlertHandler();
      default:
        return async () => ({ processed: 0, sent: 0 });
    }
  }

  /**
   * Creates handler for harvest reminders.
   */
  private createHarvestReminderHandler(): ScheduledJobHandler {
    return async () => {
      if (!this.config.dataProviders?.getUpcomingHarvests) {
        return { processed: 0, sent: 0 };
      }

      const harvests = await this.config.dataProviders.getUpcomingHarvests();
      let sent = 0;

      for (const harvest of harvests) {
        const daysUntilHarvest = Math.ceil(
          (harvest.expectedHarvestDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        // Check user preferences for reminder days
        const preferences = await this.notificationService.getUserPreferences(harvest.userId);
        if (!preferences.harvestReminders) continue;
        if (daysUntilHarvest > preferences.harvestReminderDays) continue;

        const notification = await this.notificationService.createNotification({
          userId: harvest.userId,
          cooperativeId: harvest.cooperativeId,
          type: 'harvest_reminder',
          title: 'notifications.harvest_reminder.title',
          body: 'notifications.harvest_reminder.body',
          data: {
            cropName: harvest.cropName,
            daysUntilHarvest,
            expectedDate: harvest.expectedHarvestDate.toISOString(),
          },
          relatedEntityId: harvest.plantingRecordId,
          relatedEntityType: 'planting_record',
        });

        const result = await this.notificationService.deliverNotification(notification);
        if (result.success) sent++;
      }

      return { processed: harvests.length, sent };
    };
  }

  /**
   * Creates handler for weather alerts.
   */
  private createWeatherAlertHandler(): ScheduledJobHandler {
    return async () => {
      if (!this.config.dataProviders?.getWeatherAlerts) {
        return { processed: 0, sent: 0 };
      }

      const regions: TaiwanRegion[] = ['north', 'central', 'south', 'east'];
      let processed = 0;
      let sent = 0;

      for (const region of regions) {
        const alerts = await this.config.dataProviders.getWeatherAlerts(region);

        for (const alert of alerts) {
          if (!this.config.dataProviders?.getUsersInRegion) continue;

          const users = await this.config.dataProviders.getUsersInRegion(region);
          processed += users.length;

          for (const user of users) {
            const preferences = await this.notificationService.getUserPreferences(user.userId);
            if (!preferences.weatherAlerts) continue;

            const notification = await this.notificationService.createNotification({
              userId: user.userId,
              cooperativeId: user.cooperativeId,
              type: 'weather_alert',
              title: 'notifications.weather_alert.title',
              body: 'notifications.weather_alert.body',
              priority: alert.severity === 'warning' ? 'urgent' : 'high',
              data: {
                alertType: alert.alertType,
                severity: alert.severity,
                description: alert.description,
              },
            });

            const result = await this.notificationService.deliverNotification(notification);
            if (result.success) sent++;
          }
        }
      }

      return { processed, sent };
    };
  }

  /**
   * Creates handler for price alerts.
   */
  private createPriceAlertHandler(): ScheduledJobHandler {
    return async () => {
      if (!this.config.dataProviders?.getPriceChanges) {
        return { processed: 0, sent: 0 };
      }

      const priceChanges = await this.config.dataProviders.getPriceChanges();
      let processed = 0;
      let sent = 0;

      for (const change of priceChanges) {
        if (!this.config.dataProviders?.getUsersForCrop) continue;

        const users = await this.config.dataProviders.getUsersForCrop(change.cropId);
        processed += users.length;

        for (const user of users) {
          const preferences = await this.notificationService.getUserPreferences(user.userId);
          if (!preferences.priceAlerts) continue;

          // Check if change exceeds user's threshold
          if (Math.abs(change.changePercent) < preferences.priceAlertThreshold) continue;

          const notification = await this.notificationService.createNotification({
            userId: user.userId,
            cooperativeId: user.cooperativeId,
            type: 'price_alert',
            title: 'notifications.price_alert.title',
            body: 'notifications.price_alert.body',
            data: {
              cropName: change.cropName,
              currentPrice: change.currentPrice,
              changePercent: change.changePercent,
              trend: change.trend,
            },
          });

          const result = await this.notificationService.deliverNotification(notification);
          if (result.success) sent++;
        }
      }

      return { processed, sent };
    };
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Converts a cron expression to an interval in milliseconds.
   * Simplified implementation - in production use a proper cron library.
   */
  private cronToInterval(cronExpression: string): number {
    const parts = cronExpression.split(' ');
    const minute = parts[0] ?? '*';
    const hour = parts[1] ?? '*';

    // Handle common patterns
    if (cronExpression.startsWith('*/')) {
      // Every X minutes/hours
      const value = parseInt(minute.slice(2)) || parseInt(hour.slice(2)) || 1;
      if (hour.startsWith('*/')) {
        return value * 60 * 60 * 1000; // Hours
      }
      return value * 60 * 1000; // Minutes
    }

    if (minute === '0' && /^\d+$/.test(hour)) {
      // Daily at specific hour
      return 24 * 60 * 60 * 1000; // Daily
    }

    // Check for */N pattern in hour field (like "0 */4 * * *")
    if (minute === '0' && hour.startsWith('*/')) {
      const hours = parseInt(hour.slice(2)) || 1;
      return hours * 60 * 60 * 1000;
    }

    // Default to hourly
    return 60 * 60 * 1000;
  }
}

/**
 * Factory function to create a notification scheduler.
 */
export function createNotificationScheduler(
  config: NotificationSchedulerConfig
): NotificationScheduler {
  return new NotificationScheduler(config);
}
