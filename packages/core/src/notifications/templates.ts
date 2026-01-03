/**
 * Notification Templates
 *
 * Defines templates for all notification types with i18n keys.
 */

import type { NotificationType, NotificationPriority, NotificationTemplate } from '@minori/shared';

/**
 * Notification templates for all notification types.
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  harvest_reminder: {
    id: 'harvest_reminder',
    type: 'harvest_reminder',
    titleKey: 'notifications.harvest_reminder.title',
    bodyKey: 'notifications.harvest_reminder.body',
    defaultPriority: 'medium',
    requiredFields: ['cropName', 'daysUntilHarvest', 'expectedDate'],
  },
  harvest_confirmed: {
    id: 'harvest_confirmed',
    type: 'harvest_confirmed',
    titleKey: 'notifications.harvest_confirmed.title',
    bodyKey: 'notifications.harvest_confirmed.body',
    defaultPriority: 'low',
    requiredFields: ['cropName', 'quantity', 'unit'],
  },
  planting_confirmed: {
    id: 'planting_confirmed',
    type: 'planting_confirmed',
    titleKey: 'notifications.planting_confirmed.title',
    bodyKey: 'notifications.planting_confirmed.body',
    defaultPriority: 'low',
    requiredFields: ['cropName', 'area', 'unit', 'expectedHarvestDate'],
  },
  planting_optimal: {
    id: 'planting_optimal',
    type: 'planting_optimal',
    titleKey: 'notifications.planting_optimal.title',
    bodyKey: 'notifications.planting_optimal.body',
    defaultPriority: 'medium',
    requiredFields: ['cropName', 'windowStart', 'windowEnd'],
  },
  weather_alert: {
    id: 'weather_alert',
    type: 'weather_alert',
    titleKey: 'notifications.weather_alert.title',
    bodyKey: 'notifications.weather_alert.body',
    defaultPriority: 'urgent',
    requiredFields: ['alertType', 'severity', 'description'],
  },
  weather_forecast: {
    id: 'weather_forecast',
    type: 'weather_forecast',
    titleKey: 'notifications.weather_forecast.title',
    bodyKey: 'notifications.weather_forecast.body',
    defaultPriority: 'low',
    requiredFields: ['forecastSummary', 'temperature', 'rainfall'],
  },
  price_alert: {
    id: 'price_alert',
    type: 'price_alert',
    titleKey: 'notifications.price_alert.title',
    bodyKey: 'notifications.price_alert.body',
    defaultPriority: 'medium',
    requiredFields: ['cropName', 'currentPrice', 'changePercent', 'trend'],
  },
  price_opportunity: {
    id: 'price_opportunity',
    type: 'price_opportunity',
    titleKey: 'notifications.price_opportunity.title',
    bodyKey: 'notifications.price_opportunity.body',
    defaultPriority: 'high',
    requiredFields: ['cropName', 'currentPrice', 'suggestion'],
  },
  demand_new: {
    id: 'demand_new',
    type: 'demand_new',
    titleKey: 'notifications.demand_new.title',
    bodyKey: 'notifications.demand_new.body',
    defaultPriority: 'medium',
    requiredFields: ['cropName', 'quantity', 'deliveryDate', 'buyerName'],
  },
  demand_urgent: {
    id: 'demand_urgent',
    type: 'demand_urgent',
    titleKey: 'notifications.demand_urgent.title',
    bodyKey: 'notifications.demand_urgent.body',
    defaultPriority: 'urgent',
    requiredFields: ['cropName', 'quantity', 'deadline', 'buyerName'],
  },
  match_found: {
    id: 'match_found',
    type: 'match_found',
    titleKey: 'notifications.match_found.title',
    bodyKey: 'notifications.match_found.body',
    defaultPriority: 'high',
    requiredFields: ['cropName', 'quantity', 'matchScore', 'buyerName'],
  },
  match_accepted: {
    id: 'match_accepted',
    type: 'match_accepted',
    titleKey: 'notifications.match_accepted.title',
    bodyKey: 'notifications.match_accepted.body',
    defaultPriority: 'high',
    requiredFields: ['cropName', 'quantity', 'farmerName'],
  },
  match_rejected: {
    id: 'match_rejected',
    type: 'match_rejected',
    titleKey: 'notifications.match_rejected.title',
    bodyKey: 'notifications.match_rejected.body',
    defaultPriority: 'medium',
    requiredFields: ['cropName', 'quantity', 'reason'],
  },
  match_fulfilled: {
    id: 'match_fulfilled',
    type: 'match_fulfilled',
    titleKey: 'notifications.match_fulfilled.title',
    bodyKey: 'notifications.match_fulfilled.body',
    defaultPriority: 'medium',
    requiredFields: ['cropName', 'quantity'],
  },
  cooperative_announcement: {
    id: 'cooperative_announcement',
    type: 'cooperative_announcement',
    titleKey: 'notifications.cooperative_announcement.title',
    bodyKey: 'notifications.cooperative_announcement.body',
    defaultPriority: 'medium',
    requiredFields: ['message'],
  },
  system: {
    id: 'system',
    type: 'system',
    titleKey: 'notifications.system.title',
    bodyKey: 'notifications.system.body',
    defaultPriority: 'low',
    requiredFields: ['message'],
  },
};

/**
 * Gets a notification template by type.
 */
export function getNotificationTemplate(type: NotificationType): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[type];
}

/**
 * Gets the default priority for a notification type.
 */
export function getDefaultPriority(type: NotificationType): NotificationPriority {
  return NOTIFICATION_TEMPLATES[type].defaultPriority;
}

/**
 * Validates that all required fields are present in the data.
 */
export function validateTemplateData(
  type: NotificationType,
  data: Record<string, unknown>
): { valid: boolean; missingFields: string[] } {
  const template = NOTIFICATION_TEMPLATES[type];
  const missingFields: string[] = [];

  for (const field of template.requiredFields) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
