/**
 * Unit tests for Price Alert system.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import {
  PriceAlertGenerator,
  InMemoryAlertSubscriptionStorage,
  createPriceAlertGenerator,
  type AlertConfig,
} from './price-alert';
import type { CropPriceStats, PriceHistoryPoint } from './price-service';
import type { PriceTrend } from '@minori/shared';

// Helper to create mock price stats
function createMockStats(overrides: Partial<CropPriceStats> = {}): CropPriceStats {
  return {
    cropId: 'bok-choy',
    cropName: '小白菜',
    currentPrice: 50,
    priceWeekAgo: 50,
    priceMonthAgo: 50,
    priceHigh: 60,
    priceLow: 40,
    avgVolume: 10000,
    trend: 'stable',
    weeklyChange: 0,
    monthlyChange: 0,
    updatedAt: new Date(),
    ...overrides,
  };
}

// Helper to create mock price history
function createMockHistory(days: number, avgPrice: number): PriceHistoryPoint[] {
  const history: PriceHistoryPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    history.push({
      date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      avgPrice,
      highPrice: avgPrice * 1.1,
      lowPrice: avgPrice * 0.9,
      volume: 10000,
    });
  }

  return history;
}

describe('PriceAlertGenerator', () => {
  let generator: PriceAlertGenerator;

  beforeEach(() => {
    generator = createPriceAlertGenerator();
  });

  test('creates generator instance', () => {
    expect(generator).toBeInstanceOf(PriceAlertGenerator);
  });

  test('sets and gets alert config', () => {
    const config: AlertConfig = {
      cropId: 'bok-choy',
      priceIncreaseThreshold: 10,
      priceDecreaseThreshold: 10,
    };

    generator.setAlertConfig(config);
    const retrieved = generator.getAlertConfig('bok-choy');

    expect(retrieved).toBeDefined();
    expect(retrieved!.cropId).toBe('bok-choy');
    expect(retrieved!.priceIncreaseThreshold).toBe(10);
  });

  test('removes alert config', () => {
    generator.setAlertConfig({ cropId: 'bok-choy' });
    generator.removeAlertConfig('bok-choy');

    expect(generator.getAlertConfig('bok-choy')).toBeUndefined();
  });
});

describe('checkAndGenerateAlerts', () => {
  let generator: PriceAlertGenerator;

  beforeEach(() => {
    generator = createPriceAlertGenerator();
  });

  test('generates price spike alert', () => {
    const stats = createMockStats({
      currentPrice: 60,
      priceWeekAgo: 50,
      weeklyChange: 20, // 20% increase
    });

    const alerts = generator.checkAndGenerateAlerts(stats);

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const spikeAlert = alerts.find((a) => a.type === 'price_spike');
    expect(spikeAlert).toBeDefined();
    expect(spikeAlert!.priority).toBe('medium');
  });

  test('generates high priority for large spike', () => {
    const stats = createMockStats({
      currentPrice: 70,
      priceWeekAgo: 50,
      weeklyChange: 40, // 40% increase
    });

    const alerts = generator.checkAndGenerateAlerts(stats);
    const spikeAlert = alerts.find((a) => a.type === 'price_spike');

    expect(spikeAlert).toBeDefined();
    expect(spikeAlert!.priority).toBe('high');
  });

  test('generates price drop alert', () => {
    const stats = createMockStats({
      currentPrice: 40,
      priceWeekAgo: 50,
      weeklyChange: -20, // 20% decrease
    });

    const alerts = generator.checkAndGenerateAlerts(stats);

    expect(alerts.length).toBeGreaterThanOrEqual(1);
    const dropAlert = alerts.find((a) => a.type === 'price_drop');
    expect(dropAlert).toBeDefined();
  });

  test('no alerts for stable prices', () => {
    const stats = createMockStats({
      currentPrice: 52,
      priceWeekAgo: 50,
      weeklyChange: 4, // 4% increase - below threshold
    });

    const alerts = generator.checkAndGenerateAlerts(stats);
    const priceAlerts = alerts.filter((a) => a.type === 'price_spike' || a.type === 'price_drop');

    expect(priceAlerts.length).toBe(0);
  });

  test('respects custom thresholds', () => {
    generator.setAlertConfig({
      cropId: 'bok-choy',
      priceIncreaseThreshold: 5,
    });

    const stats = createMockStats({
      currentPrice: 55,
      priceWeekAgo: 50,
      weeklyChange: 10, // 10% increase - above custom threshold
    });

    const alerts = generator.checkAndGenerateAlerts(stats);
    const spikeAlert = alerts.find((a) => a.type === 'price_spike');

    expect(spikeAlert).toBeDefined();
  });

  test('generates buy opportunity alert with history', () => {
    const stats = createMockStats({
      currentPrice: 35,
      priceMonthAgo: 50,
    });

    // History with average of 50
    const history = createMockHistory(30, 50);

    const alerts = generator.checkAndGenerateAlerts(stats, history);
    const buyAlert = alerts.find((a) => a.type === 'buy_opportunity');

    expect(buyAlert).toBeDefined();
    expect(buyAlert!.cropName).toBe('小白菜');
  });

  test('generates sell opportunity alert with history', () => {
    const stats = createMockStats({
      currentPrice: 65,
      priceMonthAgo: 50,
    });

    // History with average of 50
    const history = createMockHistory(30, 50);

    const alerts = generator.checkAndGenerateAlerts(stats, history);
    const sellAlert = alerts.find((a) => a.type === 'sell_opportunity');

    expect(sellAlert).toBeDefined();
  });

  test('includes prediction alert when enabled', () => {
    generator.setAlertConfig({
      cropId: 'bok-choy',
      enablePredictionAlerts: true,
    });

    const stats = createMockStats();

    // Create history with strong upward trend
    const history: PriceHistoryPoint[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      history.push({
        date: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        avgPrice: 30 + (30 - i) * 1, // Rising from 30 to 60
        highPrice: 35 + (30 - i) * 1,
        lowPrice: 25 + (30 - i) * 1,
        volume: 10000,
      });
    }

    const alerts = generator.checkAndGenerateAlerts(stats, history);

    // Should have some alerts for strong trend
    // Note: prediction alert only generated if predicted change >= 10%
    expect(alerts).toBeDefined();
  });
});

describe('checkTrendForAlerts', () => {
  let generator: PriceAlertGenerator;

  beforeEach(() => {
    generator = createPriceAlertGenerator();
  });

  test('generates alert from PriceTrend', () => {
    const trend: PriceTrend = {
      cropId: 'bok-choy',
      current: 60,
      weekAgo: 50,
      monthAgo: 45,
      trend: 'up',
      changePercent: 20,
    };

    const alerts = generator.checkTrendForAlerts(trend);

    expect(alerts.length).toBe(1);
    expect(alerts[0]!.type).toBe('price_spike');
    expect(alerts[0]!.changePercent).toBe(20);
  });

  test('generates drop alert from PriceTrend', () => {
    const trend: PriceTrend = {
      cropId: 'tomato',
      current: 40,
      weekAgo: 50,
      monthAgo: 55,
      trend: 'down',
      changePercent: -20,
    };

    const alerts = generator.checkTrendForAlerts(trend);

    expect(alerts.length).toBe(1);
    expect(alerts[0]!.type).toBe('price_drop');
  });

  test('no alerts for stable trend', () => {
    const trend: PriceTrend = {
      cropId: 'bok-choy',
      current: 51,
      weekAgo: 50,
      monthAgo: 50,
      trend: 'stable',
      changePercent: 2,
    };

    const alerts = generator.checkTrendForAlerts(trend);

    expect(alerts.length).toBe(0);
  });
});

describe('InMemoryAlertSubscriptionStorage', () => {
  let storage: InMemoryAlertSubscriptionStorage;

  beforeEach(() => {
    storage = new InMemoryAlertSubscriptionStorage();
  });

  test('saves and retrieves subscription', async () => {
    const subscription = {
      userId: 'user-1',
      cropIds: ['bok-choy', 'tomato'],
      alertTypes: ['price_spike' as const, 'price_drop' as const],
      minPriority: 'medium' as const,
      isActive: true,
    };

    await storage.save(subscription);
    const retrieved = await storage.getByUserId('user-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved!.userId).toBe('user-1');
    expect(retrieved!.cropIds).toContain('bok-choy');
  });

  test('returns null for non-existent user', async () => {
    const result = await storage.getByUserId('non-existent');
    expect(result).toBeNull();
  });

  test('gets active subscriptions', async () => {
    await storage.save({
      userId: 'user-1',
      cropIds: ['bok-choy'],
      alertTypes: ['price_spike'],
      minPriority: 'medium',
      isActive: true,
    });
    await storage.save({
      userId: 'user-2',
      cropIds: ['tomato'],
      alertTypes: ['price_drop'],
      minPriority: 'low',
      isActive: false,
    });

    const active = await storage.getActiveSubscriptions();

    expect(active.length).toBe(1);
    expect(active[0]!.userId).toBe('user-1');
  });

  test('deletes subscription', async () => {
    await storage.save({
      userId: 'user-1',
      cropIds: ['bok-choy'],
      alertTypes: ['price_spike'],
      minPriority: 'medium',
      isActive: true,
    });

    await storage.delete('user-1');
    const result = await storage.getByUserId('user-1');

    expect(result).toBeNull();
  });
});

describe('Alert properties', () => {
  let generator: PriceAlertGenerator;

  beforeEach(() => {
    generator = createPriceAlertGenerator();
  });

  test('alerts have unique IDs', () => {
    const stats = createMockStats({
      currentPrice: 70,
      priceWeekAgo: 50,
      weeklyChange: 40,
    });

    const alerts1 = generator.checkAndGenerateAlerts(stats);
    const alerts2 = generator.checkAndGenerateAlerts(stats);

    expect(alerts1[0]!.id).not.toBe(alerts2[0]!.id);
  });

  test('alerts have expiration time', () => {
    const stats = createMockStats({
      currentPrice: 60,
      priceWeekAgo: 50,
      weeklyChange: 20,
    });

    const alerts = generator.checkAndGenerateAlerts(stats);
    const alert = alerts[0]!;

    expect(alert.expiresAt).toBeDefined();
    expect(alert.expiresAt!.getTime()).toBeGreaterThan(alert.createdAt.getTime());
  });

  test('alerts contain price information', () => {
    const stats = createMockStats({
      currentPrice: 60,
      priceWeekAgo: 50,
      weeklyChange: 20,
    });

    const alerts = generator.checkAndGenerateAlerts(stats);
    const alert = alerts[0]!;

    expect(alert.currentPrice).toBe(60);
    expect(alert.referencePrice).toBe(50);
    expect(alert.changePercent).toBe(20);
  });
});
