/**
 * Price Service
 *
 * High-level service for fetching, caching, and analyzing agricultural price data.
 * Provides price trends, historical analysis, and market comparisons.
 */

import type { PriceTrend } from '@minori/shared';
import { MOAClient, type PriceData, MOAClientError } from './moa-client';
import { findCropByName, getCropById } from '../crops/crop-database';

/**
 * Configuration for PriceService.
 */
export interface PriceServiceConfig {
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 30 minutes) */
  cacheTTL?: number;
}

/**
 * Aggregated price statistics for a crop.
 */
export interface CropPriceStats {
  cropId: string;
  cropName: string;
  /** Latest average price (TWD/kg) */
  currentPrice: number;
  /** Price one week ago */
  priceWeekAgo: number;
  /** Price one month ago */
  priceMonthAgo: number;
  /** Highest price in the period */
  priceHigh: number;
  /** Lowest price in the period */
  priceLow: number;
  /** Average daily trading volume */
  avgVolume: number;
  /** Price trend direction */
  trend: 'up' | 'down' | 'stable';
  /** Percentage change from week ago */
  weeklyChange: number;
  /** Percentage change from month ago */
  monthlyChange: number;
  /** Data timestamp */
  updatedAt: Date;
}

/**
 * Market price comparison data.
 */
export interface MarketPriceComparison {
  cropName: string;
  markets: Array<{
    marketCode: string;
    marketName: string;
    avgPrice: number;
    volume: number;
  }>;
  cheapestMarket: string;
  mostExpensiveMarket: string;
  priceRange: number;
}

/**
 * Historical price data point for charting.
 */
export interface PriceHistoryPoint {
  date: Date;
  avgPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
}

/**
 * Cached data entry.
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Price service for agricultural price data.
 */
export class PriceService {
  private client: MOAClient;
  private cache: Map<string, CacheEntry<unknown>>;
  private cacheTTL: number;
  private enableCache: boolean;

  constructor(config: PriceServiceConfig = {}) {
    this.client = new MOAClient();
    this.cache = new Map();
    this.enableCache = config.enableCache ?? true;
    this.cacheTTL = config.cacheTTL ?? 30 * 60 * 1000; // 30 minutes default
  }

  /**
   * Gets the price trend for a crop (matches PriceTrend interface).
   *
   * @param cropId - Crop ID from the database
   * @returns Price trend data or null if no data available
   */
  async getPriceTrend(cropId: string): Promise<PriceTrend | null> {
    const crop = getCropById(cropId);
    if (!crop) {
      return null;
    }

    const cacheKey = `trend:${cropId}`;
    const cached = this.getFromCache<PriceTrend>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const stats = await this.getCropPriceStats(crop.name);
      if (!stats) {
        return null;
      }

      const trend: PriceTrend = {
        cropId: stats.cropId,
        current: stats.currentPrice,
        weekAgo: stats.priceWeekAgo,
        monthAgo: stats.priceMonthAgo,
        trend: stats.trend,
        changePercent: stats.weeklyChange,
      };

      this.setCache(cacheKey, trend);
      return trend;
    } catch (error) {
      console.warn(`Failed to get price trend for ${cropId}:`, error);
      return null;
    }
  }

  /**
   * Gets detailed price statistics for a crop.
   *
   * @param cropName - Crop name in Chinese
   * @returns Crop price statistics or null if no data
   */
  async getCropPriceStats(cropName: string): Promise<CropPriceStats | null> {
    const cacheKey = `stats:${cropName}`;
    const cached = this.getFromCache<CropPriceStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch 35 days of data to ensure we have month-ago comparison
      const priceData = await this.client.getCropPrices(cropName, 35);

      if (priceData.length === 0) {
        return null;
      }

      const stats = this.calculatePriceStats(cropName, priceData);
      this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      if (error instanceof MOAClientError) {
        console.warn(`Price data error for ${cropName}: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Gets price history for charting.
   *
   * @param cropName - Crop name in Chinese
   * @param days - Number of days of history
   * @returns Array of daily price points
   */
  async getPriceHistory(cropName: string, days = 30): Promise<PriceHistoryPoint[]> {
    const cacheKey = `history:${cropName}:${days}`;
    const cached = this.getFromCache<PriceHistoryPoint[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const priceData = await this.client.getCropPrices(cropName, days);

      if (priceData.length === 0) {
        return [];
      }

      // Group by date and aggregate
      const history = this.aggregatePriceHistory(priceData);
      this.setCache(cacheKey, history);
      return history;
    } catch {
      return [];
    }
  }

  /**
   * Compares prices across different markets for a crop.
   *
   * @param cropName - Crop name in Chinese
   * @returns Market comparison data
   */
  async compareMarketPrices(cropName: string): Promise<MarketPriceComparison | null> {
    try {
      // Get last 3 days for recent comparison
      const priceData = await this.client.getCropPrices(cropName, 3);

      if (priceData.length === 0) {
        return null;
      }

      // Group by market
      const marketData = new Map<string, { prices: number[]; volumes: number[]; name: string }>();

      for (const item of priceData) {
        const existing = marketData.get(item.marketCode) || {
          prices: [],
          volumes: [],
          name: item.marketName,
        };
        existing.prices.push(item.priceAvg);
        existing.volumes.push(item.volume);
        marketData.set(item.marketCode, existing);
      }

      const markets = Array.from(marketData.entries()).map(([code, data]) => ({
        marketCode: code,
        marketName: data.name,
        avgPrice: data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
        volume: data.volumes.reduce((a, b) => a + b, 0),
      }));

      if (markets.length === 0) {
        return null;
      }

      // Sort by price
      markets.sort((a, b) => a.avgPrice - b.avgPrice);

      return {
        cropName,
        markets,
        cheapestMarket: markets[0]!.marketName,
        mostExpensiveMarket: markets[markets.length - 1]!.marketName,
        priceRange: markets[markets.length - 1]!.avgPrice - markets[0]!.avgPrice,
      };
    } catch {
      return null;
    }
  }

  /**
   * Gets prices for multiple crops at once.
   *
   * @param cropIds - Array of crop IDs
   * @returns Map of crop ID to price trend
   */
  async getBulkPriceTrends(cropIds: string[]): Promise<Map<string, PriceTrend>> {
    const results = new Map<string, PriceTrend>();

    // Fetch in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < cropIds.length; i += batchSize) {
      const batch = cropIds.slice(i, i + batchSize);
      const promises = batch.map((id) => this.getPriceTrend(id));
      const trends = await Promise.all(promises);

      batch.forEach((id, index) => {
        const trend = trends[index];
        if (trend) {
          results.set(id, trend);
        }
      });
    }

    return results;
  }

  /**
   * Clears the price cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Calculates price statistics from raw data.
   */
  private calculatePriceStats(cropName: string, priceData: PriceData[]): CropPriceStats {
    // Sort by date descending
    const sorted = [...priceData].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Get date boundaries
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get latest price (average of most recent day's data across markets)
    const latestDate = sorted[0]!.date;
    const latestPrices = sorted.filter((p) => p.date.getTime() === latestDate.getTime());
    const currentPrice = this.calculateWeightedAvgPrice(latestPrices);

    // Get price week ago (find closest date)
    const weekAgoPrices = sorted.filter((p) => {
      const daysDiff = Math.abs(p.date.getTime() - weekAgo.getTime()) / (24 * 60 * 60 * 1000);
      return daysDiff < 3; // Within 3 days of target
    });
    const priceWeekAgo =
      weekAgoPrices.length > 0 ? this.calculateWeightedAvgPrice(weekAgoPrices) : currentPrice;

    // Get price month ago
    const monthAgoPrices = sorted.filter((p) => {
      const daysDiff = Math.abs(p.date.getTime() - monthAgo.getTime()) / (24 * 60 * 60 * 1000);
      return daysDiff < 3;
    });
    const priceMonthAgo =
      monthAgoPrices.length > 0 ? this.calculateWeightedAvgPrice(monthAgoPrices) : currentPrice;

    // Calculate high/low across period
    const priceHigh = Math.max(...priceData.map((p) => p.priceHigh));
    const priceLow = Math.min(...priceData.filter((p) => p.priceLow > 0).map((p) => p.priceLow));

    // Calculate average volume
    const totalVolume = priceData.reduce((sum, p) => sum + p.volume, 0);
    const uniqueDays = new Set(priceData.map((p) => p.date.toISOString().split('T')[0])).size;
    const avgVolume = uniqueDays > 0 ? totalVolume / uniqueDays : 0;

    // Determine trend
    const weeklyChange =
      priceWeekAgo > 0 ? ((currentPrice - priceWeekAgo) / priceWeekAgo) * 100 : 0;
    const monthlyChange =
      priceMonthAgo > 0 ? ((currentPrice - priceMonthAgo) / priceMonthAgo) * 100 : 0;

    let trend: 'up' | 'down' | 'stable';
    if (weeklyChange > 5) {
      trend = 'up';
    } else if (weeklyChange < -5) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    // Try to find crop ID
    const crop = findCropByName(cropName);

    return {
      cropId: crop?.id || cropName,
      cropName,
      currentPrice,
      priceWeekAgo,
      priceMonthAgo,
      priceHigh,
      priceLow,
      avgVolume,
      trend,
      weeklyChange,
      monthlyChange,
      updatedAt: new Date(),
    };
  }

  /**
   * Calculates volume-weighted average price.
   */
  private calculateWeightedAvgPrice(priceData: PriceData[]): number {
    const totalVolume = priceData.reduce((sum, p) => sum + p.volume, 0);

    if (totalVolume === 0) {
      // Fall back to simple average
      return priceData.reduce((sum, p) => sum + p.priceAvg, 0) / priceData.length;
    }

    const weightedSum = priceData.reduce((sum, p) => sum + p.priceAvg * p.volume, 0);
    return weightedSum / totalVolume;
  }

  /**
   * Aggregates price data into daily history points.
   */
  private aggregatePriceHistory(priceData: PriceData[]): PriceHistoryPoint[] {
    // Group by date
    const byDate = new Map<string, PriceData[]>();

    for (const item of priceData) {
      const dateKey = item.date.toISOString().split('T')[0]!;
      const existing = byDate.get(dateKey) || [];
      existing.push(item);
      byDate.set(dateKey, existing);
    }

    // Aggregate each day
    const history: PriceHistoryPoint[] = [];

    for (const [dateStr, items] of byDate) {
      const date = new Date(dateStr);
      const avgPrice = this.calculateWeightedAvgPrice(items);
      const highPrice = Math.max(...items.map((p) => p.priceHigh));
      const lowPrice = Math.min(...items.filter((p) => p.priceLow > 0).map((p) => p.priceLow));
      const volume = items.reduce((sum, p) => sum + p.volume, 0);

      history.push({ date, avgPrice, highPrice, lowPrice, volume });
    }

    // Sort by date ascending
    history.sort((a, b) => a.date.getTime() - b.date.getTime());

    return history;
  }

  /**
   * Gets item from cache if valid.
   */
  private getFromCache<T>(key: string): T | null {
    if (!this.enableCache) {
      return null;
    }

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Sets item in cache.
   */
  private setCache<T>(key: string, data: T): void {
    if (!this.enableCache) {
      return;
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

/**
 * Creates a PriceService instance.
 */
export function createPriceService(config?: PriceServiceConfig): PriceService {
  return new PriceService(config);
}
