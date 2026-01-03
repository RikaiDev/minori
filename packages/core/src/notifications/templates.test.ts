/**
 * Tests for Notification Templates
 */

import { describe, expect, test } from 'bun:test';
import {
  NOTIFICATION_TEMPLATES,
  getNotificationTemplate,
  getDefaultPriority,
  validateTemplateData,
} from './templates';
import type { NotificationType } from '@minori/shared';

describe('Notification Templates', () => {
  describe('NOTIFICATION_TEMPLATES', () => {
    test('has template for all notification types', () => {
      const types: NotificationType[] = [
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
      ];

      for (const type of types) {
        expect(NOTIFICATION_TEMPLATES[type]).toBeDefined();
        expect(NOTIFICATION_TEMPLATES[type].id).toBe(type);
        expect(NOTIFICATION_TEMPLATES[type].type).toBe(type);
      }
    });

    test('all templates have required properties', () => {
      for (const [_type, template] of Object.entries(NOTIFICATION_TEMPLATES)) {
        expect(template.titleKey).toMatch(/^notifications\./);
        expect(template.bodyKey).toMatch(/^notifications\./);
        expect(['low', 'medium', 'high', 'urgent']).toContain(template.defaultPriority);
        expect(Array.isArray(template.requiredFields)).toBe(true);
      }
    });
  });

  describe('getNotificationTemplate', () => {
    test('returns correct template for each type', () => {
      const template = getNotificationTemplate('harvest_reminder');
      expect(template.id).toBe('harvest_reminder');
      expect(template.titleKey).toBe('notifications.harvest_reminder.title');
      expect(template.bodyKey).toBe('notifications.harvest_reminder.body');
    });

    test('returns weather_alert with urgent priority', () => {
      const template = getNotificationTemplate('weather_alert');
      expect(template.defaultPriority).toBe('urgent');
    });

    test('returns system with low priority', () => {
      const template = getNotificationTemplate('system');
      expect(template.defaultPriority).toBe('low');
    });
  });

  describe('getDefaultPriority', () => {
    test('returns correct priority for each type', () => {
      expect(getDefaultPriority('harvest_reminder')).toBe('medium');
      expect(getDefaultPriority('harvest_confirmed')).toBe('low');
      expect(getDefaultPriority('weather_alert')).toBe('urgent');
      expect(getDefaultPriority('weather_forecast')).toBe('low');
      expect(getDefaultPriority('price_alert')).toBe('medium');
      expect(getDefaultPriority('price_opportunity')).toBe('high');
      expect(getDefaultPriority('demand_new')).toBe('medium');
      expect(getDefaultPriority('demand_urgent')).toBe('urgent');
      expect(getDefaultPriority('match_found')).toBe('high');
      expect(getDefaultPriority('system')).toBe('low');
    });
  });

  describe('validateTemplateData', () => {
    test('validates harvest_reminder with all required fields', () => {
      const result = validateTemplateData('harvest_reminder', {
        cropName: 'Bok Choy',
        daysUntilHarvest: 3,
        expectedDate: '2025-01-15',
      });

      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    test('detects missing fields for harvest_reminder', () => {
      const result = validateTemplateData('harvest_reminder', {
        cropName: 'Bok Choy',
      });

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('daysUntilHarvest');
      expect(result.missingFields).toContain('expectedDate');
    });

    test('validates weather_alert with all required fields', () => {
      const result = validateTemplateData('weather_alert', {
        alertType: 'Typhoon Warning',
        severity: 'high',
        description: 'Typhoon approaching Taiwan',
      });

      expect(result.valid).toBe(true);
    });

    test('validates price_alert with all required fields', () => {
      const result = validateTemplateData('price_alert', {
        cropName: 'Tomato',
        currentPrice: 45,
        changePercent: 15,
        trend: 'up',
      });

      expect(result.valid).toBe(true);
    });

    test('validates demand_new with all required fields', () => {
      const result = validateTemplateData('demand_new', {
        cropName: 'Cabbage',
        quantity: 100,
        deliveryDate: '2025-01-20',
        buyerName: 'Restaurant ABC',
      });

      expect(result.valid).toBe(true);
    });

    test('validates match_found with all required fields', () => {
      const result = validateTemplateData('match_found', {
        cropName: 'Bok Choy',
        quantity: 50,
        matchScore: 85,
        buyerName: 'Market XYZ',
      });

      expect(result.valid).toBe(true);
    });

    test('treats null and undefined as missing', () => {
      const result = validateTemplateData('harvest_reminder', {
        cropName: 'Bok Choy',
        daysUntilHarvest: null,
        expectedDate: undefined,
      });

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('daysUntilHarvest');
      expect(result.missingFields).toContain('expectedDate');
    });

    test('validates cooperative_announcement', () => {
      const result = validateTemplateData('cooperative_announcement', {
        message: 'Important meeting tomorrow',
      });

      expect(result.valid).toBe(true);
    });

    test('validates system notification', () => {
      const result = validateTemplateData('system', {
        message: 'System maintenance scheduled',
      });

      expect(result.valid).toBe(true);
    });
  });
});
