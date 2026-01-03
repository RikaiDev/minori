/**
 * Tests for Notification Scheduler
 */

import { describe, expect, test } from 'bun:test';
import { NotificationScheduler, createNotificationScheduler, DEFAULT_SCHEDULES } from './scheduler';
import { createNotificationService } from './notification-service';
import type { TaiwanRegion } from '@minori/shared';

describe('NotificationScheduler', () => {
  describe('DEFAULT_SCHEDULES', () => {
    test('has all expected default schedules', () => {
      expect(DEFAULT_SCHEDULES).toHaveLength(4);

      const scheduleIds = DEFAULT_SCHEDULES.map((s) => s.id);
      expect(scheduleIds).toContain('harvest_reminder_daily');
      expect(scheduleIds).toContain('weather_alert_check');
      expect(scheduleIds).toContain('price_alert_daily');
      expect(scheduleIds).toContain('daily_digest');
    });

    test('all schedules have valid cron expressions', () => {
      for (const schedule of DEFAULT_SCHEDULES) {
        expect(schedule.cronExpression).toMatch(/^[\d*/,\s]+$/);
        expect(schedule.isActive).toBe(true);
        expect(schedule.name).toBeDefined();
      }
    });

    test('harvest_reminder runs daily at 8 AM', () => {
      const schedule = DEFAULT_SCHEDULES.find((s) => s.id === 'harvest_reminder_daily');
      expect(schedule?.cronExpression).toBe('0 8 * * *');
    });

    test('weather_alert runs every 4 hours', () => {
      const schedule = DEFAULT_SCHEDULES.find((s) => s.id === 'weather_alert_check');
      expect(schedule?.cronExpression).toBe('0 */4 * * *');
    });
  });

  describe('createNotificationScheduler', () => {
    test('creates a scheduler with default schedules', () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({ notificationService });

      expect(scheduler).toBeInstanceOf(NotificationScheduler);

      const jobs = scheduler.getJobs();
      expect(jobs).toHaveLength(4);
    });

    test('creates a scheduler with custom schedules', () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [
          {
            id: 'custom_job',
            name: 'Custom Job',
            cronExpression: '0 * * * *',
            notificationType: 'system',
            isActive: true,
          },
        ],
      });

      const jobs = scheduler.getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.id).toBe('custom_job');
    });
  });

  describe('registerJob', () => {
    test('registers a new job', () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [],
      });

      scheduler.registerJob({
        id: 'new_job',
        name: 'New Job',
        cronExpression: '0 12 * * *',
        notificationType: 'system',
        isActive: true,
      });

      const jobs = scheduler.getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.id).toBe('new_job');
    });
  });

  describe('getJobs', () => {
    test('returns all registered jobs', () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({ notificationService });

      const jobs = scheduler.getJobs();
      expect(jobs.length).toBeGreaterThan(0);

      for (const job of jobs) {
        expect(job.id).toBeDefined();
        expect(job.name).toBeDefined();
        expect(job.cronExpression).toBeDefined();
        expect(job.notificationType).toBeDefined();
      }
    });
  });

  describe('setJobActive', () => {
    test('activates and deactivates jobs', () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({ notificationService });

      const jobs = scheduler.getJobs();
      expect(jobs.length).toBeGreaterThan(0);
      const jobId = jobs[0]!.id;

      scheduler.setJobActive(jobId, false);
      expect(scheduler.getJobs().find((j) => j.id === jobId)?.isActive).toBe(false);

      scheduler.setJobActive(jobId, true);
      expect(scheduler.getJobs().find((j) => j.id === jobId)?.isActive).toBe(true);
    });

    test('handles non-existent job gracefully', () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({ notificationService });

      // Should not throw
      scheduler.setJobActive('non_existent', true);
    });
  });

  describe('runJob', () => {
    test('runs a job immediately', async () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [
          {
            id: 'test_job',
            name: 'Test Job',
            cronExpression: '0 0 * * *',
            notificationType: 'system',
            isActive: true,
          },
        ],
      });

      const result = await scheduler.runJob('test_job');

      expect(result.processed).toBeDefined();
      expect(result.sent).toBeDefined();
    });

    test('throws error for non-existent job', async () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({ notificationService });

      await expect(scheduler.runJob('non_existent')).rejects.toThrow('Job non_existent not found');
    });

    test('updates lastRunAt after running job', async () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [
          {
            id: 'track_job',
            name: 'Track Job',
            cronExpression: '0 0 * * *',
            notificationType: 'system',
            isActive: true,
          },
        ],
      });

      const jobsBefore = scheduler.getJobs();
      expect(jobsBefore.length).toBeGreaterThan(0);
      const beforeRun = jobsBefore[0]!.lastRunAt;

      await scheduler.runJob('track_job');

      const jobsAfter = scheduler.getJobs();
      expect(jobsAfter.length).toBeGreaterThan(0);
      const afterRun = jobsAfter[0]!.lastRunAt;
      expect(afterRun).toBeInstanceOf(Date);
      expect(afterRun).not.toBe(beforeRun);
    });
  });

  describe('harvest reminder handler', () => {
    test('processes upcoming harvests', async () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [
          {
            id: 'harvest_test',
            name: 'Harvest Test',
            cronExpression: '0 8 * * *',
            notificationType: 'harvest_reminder',
            isActive: true,
          },
        ],
        dataProviders: {
          getUpcomingHarvests: async () => [
            {
              userId: 'farmer_1',
              cooperativeId: 'coop_1',
              cropName: 'Bok Choy',
              expectedHarvestDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
              plantingRecordId: 'planting_1',
            },
          ],
        },
      });

      const result = await scheduler.runJob('harvest_test');

      expect(result.processed).toBe(1);
    });
  });

  describe('weather alert handler', () => {
    test('processes weather alerts for regions', async () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [
          {
            id: 'weather_test',
            name: 'Weather Test',
            cronExpression: '0 */4 * * *',
            notificationType: 'weather_alert',
            isActive: true,
          },
        ],
        dataProviders: {
          getWeatherAlerts: async (region: TaiwanRegion) => {
            if (region === 'north') {
              return [
                {
                  alertType: 'Rain Warning',
                  severity: 'warning',
                  description: 'Heavy rain expected',
                  affectedAreas: ['Taipei', 'New Taipei'],
                },
              ];
            }
            return [];
          },
          getUsersInRegion: async (region: TaiwanRegion) => {
            if (region === 'north') {
              return [{ userId: 'user_north_1', cooperativeId: 'coop_1' }];
            }
            return [];
          },
        },
      });

      const result = await scheduler.runJob('weather_test');

      expect(result.processed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('price alert handler', () => {
    test('processes price changes', async () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [
          {
            id: 'price_test',
            name: 'Price Test',
            cronExpression: '0 9 * * *',
            notificationType: 'price_alert',
            isActive: true,
          },
        ],
        dataProviders: {
          getPriceChanges: async () => [
            {
              cropId: 'tomato',
              cropName: 'Tomato',
              currentPrice: 45,
              changePercent: 20,
              trend: 'up' as const,
            },
          ],
          getUsersForCrop: async (cropId: string) => {
            if (cropId === 'tomato') {
              return [
                { userId: 'farmer_tomato_1', cooperativeId: 'coop_1' },
                { userId: 'farmer_tomato_2', cooperativeId: 'coop_1' },
              ];
            }
            return [];
          },
        },
      });

      const result = await scheduler.runJob('price_test');

      expect(result.processed).toBeGreaterThanOrEqual(2);
    });
  });

  describe('start and stop', () => {
    test('starts and stops scheduler', () => {
      const notificationService = createNotificationService();
      const scheduler = createNotificationScheduler({
        notificationService,
        schedules: [
          {
            id: 'start_stop_test',
            name: 'Start Stop Test',
            cronExpression: '0 * * * *',
            notificationType: 'system',
            isActive: true,
          },
        ],
      });

      // Start scheduler
      scheduler.start();

      // Calling start again should be safe
      scheduler.start();

      // Stop scheduler
      scheduler.stop();

      // Calling stop again should be safe
      scheduler.stop();
    });
  });
});
