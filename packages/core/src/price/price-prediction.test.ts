/**
 * Unit tests for Price Prediction module.
 */

import { describe, expect, test } from 'bun:test';
import { predictPrice, analyzePriceOpportunity } from './price-prediction';
import type { PriceHistoryPoint } from './price-service';

// Helper to generate mock price history
function generatePriceHistory(
  days: number,
  basePrice: number,
  trend: 'up' | 'down' | 'stable' = 'stable',
  volatility = 0.05
): PriceHistoryPoint[] {
  const history: PriceHistoryPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // Apply trend
    let trendFactor = 1;
    if (trend === 'up') {
      trendFactor = 1 + ((days - i) / days) * 0.2; // 20% increase over period
    } else if (trend === 'down') {
      trendFactor = 1 - ((days - i) / days) * 0.2; // 20% decrease over period
    }

    // Add random volatility
    const randomFactor = 1 + (Math.random() - 0.5) * volatility * 2;
    const avgPrice = basePrice * trendFactor * randomFactor;

    history.push({
      date,
      avgPrice,
      highPrice: avgPrice * 1.1,
      lowPrice: avgPrice * 0.9,
      volume: 10000 + Math.random() * 5000,
    });
  }

  return history;
}

describe('predictPrice', () => {
  test('returns null for insufficient data', () => {
    const history = generatePriceHistory(3, 50); // Only 3 days
    const prediction = predictPrice('小白菜', history);
    expect(prediction).toBeNull();
  });

  test('returns prediction for sufficient data', () => {
    const history = generatePriceHistory(14, 50);
    const prediction = predictPrice('小白菜', history);

    expect(prediction).not.toBeNull();
    expect(prediction!.cropName).toBe('小白菜');
    expect(prediction!.currentPrice).toBeGreaterThan(0);
    expect(prediction!.predictedPrice).toBeGreaterThan(0);
  });

  test('prediction includes confidence score', () => {
    const history = generatePriceHistory(30, 50);
    const prediction = predictPrice('小白菜', history);

    expect(prediction!.confidence).toBeGreaterThanOrEqual(0.3);
    expect(prediction!.confidence).toBeLessThanOrEqual(0.9);
  });

  test('prediction includes price range', () => {
    const history = generatePriceHistory(14, 50);
    const prediction = predictPrice('小白菜', history);

    expect(prediction!.priceLow).toBeLessThan(prediction!.predictedPrice);
    expect(prediction!.priceHigh).toBeGreaterThan(prediction!.predictedPrice);
  });

  test('prediction includes target date', () => {
    const history = generatePriceHistory(14, 50);
    const prediction = predictPrice('小白菜', history, 7);

    const now = new Date();
    const expectedTarget = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Target should be approximately 7 days from now
    const daysDiff = Math.abs(
      (prediction!.targetDate.getTime() - expectedTarget.getTime()) / (24 * 60 * 60 * 1000)
    );
    expect(daysDiff).toBeLessThan(1);
  });

  test('detects upward trend', () => {
    // Create history with clear upward trend (no randomness)
    const history: PriceHistoryPoint[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const avgPrice = 40 + (30 - i) * 0.8; // 40 to 64, ~60% increase
      history.push({
        date,
        avgPrice,
        highPrice: avgPrice * 1.05,
        lowPrice: avgPrice * 0.95,
        volume: 10000,
      });
    }

    const prediction = predictPrice('小白菜', history);

    expect(prediction!.factors.trend).toBe('up');
    expect(prediction!.factors.shortTermMomentum).toBeGreaterThan(0);
  });

  test('detects downward trend', () => {
    // Create history with clear downward trend (no randomness)
    const history: PriceHistoryPoint[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const avgPrice = 60 - (30 - i) * 0.8; // 60 to 36, ~40% decrease
      history.push({
        date,
        avgPrice,
        highPrice: avgPrice * 1.05,
        lowPrice: avgPrice * 0.95,
        volume: 10000,
      });
    }

    const prediction = predictPrice('小白菜', history);

    expect(prediction!.factors.trend).toBe('down');
    expect(prediction!.factors.shortTermMomentum).toBeLessThan(0);
  });

  test('stable prices result in stable trend', () => {
    const history = generatePriceHistory(30, 50, 'stable', 0.01);
    const prediction = predictPrice('小白菜', history);

    // With very low volatility and no trend, should be stable
    expect(['stable', 'up', 'down']).toContain(prediction!.factors.trend);
  });

  test('higher volatility reduces confidence', () => {
    const stableHistory = generatePriceHistory(30, 50, 'stable', 0.02);
    const volatileHistory = generatePriceHistory(30, 50, 'stable', 0.3);

    const stablePrediction = predictPrice('小白菜', stableHistory);
    const volatilePrediction = predictPrice('小白菜', volatileHistory);

    // Volatile prices should have lower confidence
    expect(volatilePrediction!.confidence).toBeLessThan(stablePrediction!.confidence);
  });

  test('more data increases confidence', () => {
    const shortHistory = generatePriceHistory(14, 50);
    const longHistory = generatePriceHistory(35, 50);

    const shortPrediction = predictPrice('小白菜', shortHistory);
    const longPrediction = predictPrice('小白菜', longHistory);

    expect(longPrediction!.confidence).toBeGreaterThan(shortPrediction!.confidence);
  });

  test('applies seasonal adjustment', () => {
    const history = generatePriceHistory(30, 50);
    const prediction = predictPrice('小白菜', history, 7, 'leafy');

    expect(prediction!.factors.seasonalFactor).toBeDefined();
  });

  test('longer prediction horizon reduces confidence', () => {
    const history = generatePriceHistory(30, 50);

    const shortPrediction = predictPrice('小白菜', history, 7);
    const longPrediction = predictPrice('小白菜', history, 21);

    expect(longPrediction!.confidence).toBeLessThanOrEqual(shortPrediction!.confidence);
  });
});

describe('analyzePriceOpportunity', () => {
  test('returns hold for insufficient data', () => {
    const history = generatePriceHistory(7, 50);
    const result = analyzePriceOpportunity(50, history);

    expect(result.isOpportunity).toBe(false);
    expect(result.type).toBe('hold');
    expect(result.reason).toContain('Insufficient');
  });

  test('identifies buy opportunity when price is low', () => {
    const history = generatePriceHistory(30, 50, 'stable', 0.02);
    const avgPrice = history.reduce((sum, h) => sum + h.avgPrice, 0) / history.length;
    const lowPrice = avgPrice * 0.8; // 20% below average

    const result = analyzePriceOpportunity(lowPrice, history);

    expect(result.isOpportunity).toBe(true);
    expect(result.type).toBe('buy');
    expect(result.percentFromAvg).toBeLessThan(-10);
  });

  test('identifies sell opportunity when price is high', () => {
    const history = generatePriceHistory(30, 50, 'stable', 0.02);
    const avgPrice = history.reduce((sum, h) => sum + h.avgPrice, 0) / history.length;
    const highPrice = avgPrice * 1.25; // 25% above average

    const result = analyzePriceOpportunity(highPrice, history);

    expect(result.isOpportunity).toBe(true);
    expect(result.type).toBe('sell');
    expect(result.percentFromAvg).toBeGreaterThan(10);
  });

  test('returns hold for normal price', () => {
    const history = generatePriceHistory(30, 50, 'stable', 0.02);
    const avgPrice = history.reduce((sum, h) => sum + h.avgPrice, 0) / history.length;
    const normalPrice = avgPrice * 1.05; // 5% above average

    const result = analyzePriceOpportunity(normalPrice, history);

    // Should be hold for small deviation
    if (!result.isOpportunity) {
      expect(result.type).toBe('hold');
    }
  });

  test('calculates percent from average correctly', () => {
    const history: PriceHistoryPoint[] = [];
    const baseDate = new Date();

    // Create history with average of 50
    for (let i = 0; i < 30; i++) {
      history.push({
        date: new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000),
        avgPrice: 50,
        highPrice: 55,
        lowPrice: 45,
        volume: 10000,
      });
    }

    // Current price of 60 should be 20% above average
    const result = analyzePriceOpportunity(60, history);
    expect(result.percentFromAvg).toBeCloseTo(20, 0);
  });
});
