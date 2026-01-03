/**
 * Price Prediction Module
 *
 * Predicts future crop prices using statistical methods including:
 * - Moving averages for trend detection
 * - Seasonal pattern analysis
 * - Price momentum indicators
 */

import type { PriceHistoryPoint } from './price-service';

/**
 * Price prediction result.
 */
export interface PricePrediction {
  /** Crop name */
  cropName: string;
  /** Current price */
  currentPrice: number;
  /** Predicted price for target date */
  predictedPrice: number;
  /** Prediction confidence (0-1) */
  confidence: number;
  /** Lower bound of prediction range */
  priceLow: number;
  /** Upper bound of prediction range */
  priceHigh: number;
  /** Target date for prediction */
  targetDate: Date;
  /** Factors that influenced the prediction */
  factors: PricePredictionFactors;
}

/**
 * Factors used in price prediction.
 */
export interface PricePredictionFactors {
  /** Trend direction from moving average */
  trend: 'up' | 'down' | 'stable';
  /** Short-term momentum (7-day) */
  shortTermMomentum: number;
  /** Long-term momentum (30-day) */
  longTermMomentum: number;
  /** Volatility (price variance) */
  volatility: number;
  /** Seasonal adjustment factor */
  seasonalFactor: number;
}

/**
 * Seasonal price patterns by month.
 * Positive values indicate typically higher prices.
 * Based on Taiwan agricultural market patterns.
 */
const SEASONAL_PATTERNS: Record<string, number[]> = {
  // Leafy vegetables: higher in summer (typhoon season), lower in winter
  leafy: [0, 0, -0.05, -0.05, 0.05, 0.15, 0.2, 0.25, 0.15, 0.05, 0, -0.05],
  // Root vegetables: higher in summer, lower in autumn harvest season
  root: [0.05, 0.05, 0, -0.05, 0.05, 0.1, 0.15, 0.1, -0.05, -0.1, -0.05, 0],
  // Fruits: varies by fruit type, general pattern
  fruit: [0, -0.05, -0.1, -0.05, 0, 0.05, 0.1, 0.1, 0.05, 0, 0, 0],
  // Default pattern
  default: [0, 0, 0, 0, 0, 0.05, 0.1, 0.1, 0.05, 0, 0, 0],
};

/**
 * Calculates simple moving average.
 *
 * @param values - Array of values
 * @param period - Number of periods for average
 * @returns Moving average value
 */
function calculateSMA(values: number[], period: number): number {
  if (values.length < period) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  const recentValues = values.slice(-period);
  return recentValues.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculates exponential moving average.
 *
 * @param values - Array of values
 * @param period - Number of periods
 * @returns EMA value
 */
function calculateEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) {
    return calculateSMA(values, period);
  }

  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(values.slice(0, period), period);

  for (let i = period; i < values.length; i++) {
    ema = (values[i]! - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculates price volatility (standard deviation / mean).
 *
 * @param values - Array of prices
 * @returns Volatility coefficient (0-1, higher = more volatile)
 */
function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;

  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / mean;
}

/**
 * Gets seasonal adjustment factor for a given month and crop category.
 *
 * @param month - Month (0-11)
 * @param category - Crop category
 * @returns Seasonal adjustment factor
 */
function getSeasonalFactor(
  month: number,
  category: 'leafy' | 'root' | 'fruit' | 'default' = 'default'
): number {
  const pattern = SEASONAL_PATTERNS[category] || SEASONAL_PATTERNS.default!;
  return pattern[month] || 0;
}

/**
 * Predicts future price based on historical data.
 *
 * @param cropName - Name of the crop
 * @param history - Historical price data
 * @param daysAhead - Number of days to predict ahead (default: 7)
 * @param category - Crop category for seasonal adjustment
 * @returns Price prediction or null if insufficient data
 */
export function predictPrice(
  cropName: string,
  history: PriceHistoryPoint[],
  daysAhead = 7,
  category: 'leafy' | 'root' | 'fruit' | 'default' = 'default'
): PricePrediction | null {
  if (history.length < 7) {
    // Need at least 7 days of data for meaningful prediction
    return null;
  }

  // Sort by date ascending
  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const prices = sorted.map((h) => h.avgPrice);

  // Calculate current price (most recent)
  const currentPrice = prices[prices.length - 1]!;

  // Calculate moving averages
  const sma14 = calculateSMA(prices, Math.min(14, prices.length));
  const ema7 = calculateEMA(prices, 7);

  // Determine trend
  let trend: 'up' | 'down' | 'stable';
  if (ema7 > sma14 * 1.02) {
    trend = 'up';
  } else if (ema7 < sma14 * 0.98) {
    trend = 'down';
  } else {
    trend = 'stable';
  }

  // Calculate momentum
  const recentPrices = prices.slice(-7);
  const olderPrices = prices.slice(-14, -7);

  const shortTermMomentum =
    recentPrices.length > 0 && olderPrices.length > 0
      ? calculateSMA(recentPrices, 7) / calculateSMA(olderPrices, 7) - 1
      : 0;

  const monthOldPrices = prices.slice(0, 7);
  const longTermMomentum =
    prices.length >= 14
      ? calculateSMA(recentPrices, 7) / calculateSMA(monthOldPrices, 7) - 1
      : shortTermMomentum;

  // Calculate volatility
  const volatility = calculateVolatility(prices);

  // Get seasonal factor for target date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysAhead);
  const seasonalFactor = getSeasonalFactor(targetDate.getMonth(), category);

  // Calculate predicted price
  // Base: current price
  // Adjust for: trend momentum, seasonal pattern
  const trendAdjustment = shortTermMomentum * (daysAhead / 7) * 0.5; // Dampen trend effect
  const seasonalAdjustment = seasonalFactor;

  let predictedPrice = currentPrice * (1 + trendAdjustment + seasonalAdjustment);

  // Apply mean reversion if price is far from moving average
  const deviation = (currentPrice - sma14) / sma14;
  if (Math.abs(deviation) > 0.1) {
    // Price is more than 10% from average, apply mean reversion
    const reversionFactor = -deviation * 0.3 * (daysAhead / 7);
    predictedPrice = predictedPrice * (1 + reversionFactor);
  }

  // Ensure predicted price is positive
  predictedPrice = Math.max(predictedPrice, currentPrice * 0.5);

  // Calculate confidence based on volatility and data quality
  let confidence = 0.7; // Base confidence

  // Lower confidence for volatile prices
  confidence -= volatility * 0.5;

  // Lower confidence for longer predictions
  confidence -= (daysAhead - 7) * 0.02;

  // Higher confidence with more data
  if (history.length >= 30) {
    confidence += 0.1;
  }

  confidence = Math.max(0.3, Math.min(0.9, confidence));

  // Calculate prediction range based on volatility
  const rangeMultiplier = 1 + volatility + daysAhead / 30;
  const priceRange = predictedPrice * rangeMultiplier * 0.15;

  return {
    cropName,
    currentPrice,
    predictedPrice,
    confidence,
    priceLow: Math.max(0, predictedPrice - priceRange),
    priceHigh: predictedPrice + priceRange,
    targetDate,
    factors: {
      trend,
      shortTermMomentum,
      longTermMomentum,
      volatility,
      seasonalFactor,
    },
  };
}

/**
 * Identifies price opportunities (unusually low or high prices).
 *
 * @param currentPrice - Current price
 * @param history - Historical price data
 * @returns Opportunity analysis
 */
export function analyzePriceOpportunity(
  currentPrice: number,
  history: PriceHistoryPoint[]
): {
  isOpportunity: boolean;
  type: 'buy' | 'sell' | 'hold';
  reason: string;
  percentFromAvg: number;
} {
  if (history.length < 14) {
    return {
      isOpportunity: false,
      type: 'hold',
      reason: 'Insufficient historical data',
      percentFromAvg: 0,
    };
  }

  const prices = history.map((h) => h.avgPrice);
  const avgPrice = calculateSMA(prices, prices.length);
  const percentFromAvg = ((currentPrice - avgPrice) / avgPrice) * 100;

  // Price is significantly below average
  if (percentFromAvg < -15) {
    return {
      isOpportunity: true,
      type: 'buy',
      reason: 'Price is significantly below historical average',
      percentFromAvg,
    };
  }

  // Price is significantly above average
  if (percentFromAvg > 20) {
    return {
      isOpportunity: true,
      type: 'sell',
      reason: 'Price is significantly above historical average',
      percentFromAvg,
    };
  }

  // Check recent trend for momentum opportunities
  const recentPrices = prices.slice(-7);
  const momentum = recentPrices[recentPrices.length - 1]! / recentPrices[0]! - 1;

  if (momentum < -0.1 && percentFromAvg < -10) {
    return {
      isOpportunity: true,
      type: 'buy',
      reason: 'Price dropping rapidly, potential buying opportunity',
      percentFromAvg,
    };
  }

  if (momentum > 0.1 && percentFromAvg > 10) {
    return {
      isOpportunity: true,
      type: 'sell',
      reason: 'Price rising rapidly, consider selling',
      percentFromAvg,
    };
  }

  return {
    isOpportunity: false,
    type: 'hold',
    reason: 'Price is within normal range',
    percentFromAvg,
  };
}
