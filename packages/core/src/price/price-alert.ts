/**
 * Price Alert System
 *
 * Monitors crop prices and generates alerts for farmers when:
 * - Prices rise or fall significantly
 * - Good buying or selling opportunities emerge
 * - Predicted price changes may affect profitability
 */

import type { PriceTrend } from '@minori/shared';
import type { CropPriceStats, PriceHistoryPoint } from './price-service';
import { predictPrice, analyzePriceOpportunity, type PricePrediction } from './price-prediction';

/**
 * Types of price alerts.
 */
export type AlertType =
  | 'price_spike' // Sudden price increase
  | 'price_drop' // Sudden price decrease
  | 'buy_opportunity' // Good time to buy inputs/seeds
  | 'sell_opportunity' // Good time to sell harvest
  | 'price_prediction' // Predicted future price change
  | 'market_anomaly'; // Unusual market condition

/**
 * Alert priority levels.
 */
export type AlertPriority = 'high' | 'medium' | 'low';

/**
 * A price alert for a farmer.
 */
export interface PriceAlert {
  /** Unique alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Priority level */
  priority: AlertPriority;
  /** Crop ID */
  cropId: string;
  /** Crop name for display */
  cropName: string;
  /** Alert title */
  title: string;
  /** Detailed message */
  message: string;
  /** Current price */
  currentPrice: number;
  /** Reference price (comparison baseline) */
  referencePrice: number;
  /** Percentage change from reference */
  changePercent: number;
  /** When the alert was generated */
  createdAt: Date;
  /** Optional expiration time */
  expiresAt?: Date;
  /** Additional data for the alert */
  metadata?: Record<string, unknown>;
}

/**
 * Alert configuration for a specific crop.
 */
export interface AlertConfig {
  /** Crop ID to monitor */
  cropId: string;
  /** Threshold for price increase alerts (percentage) */
  priceIncreaseThreshold?: number;
  /** Threshold for price decrease alerts (percentage) */
  priceDecreaseThreshold?: number;
  /** Enable buying opportunity alerts */
  enableBuyAlerts?: boolean;
  /** Enable selling opportunity alerts */
  enableSellAlerts?: boolean;
  /** Enable prediction-based alerts */
  enablePredictionAlerts?: boolean;
}

/**
 * Default alert thresholds.
 */
const DEFAULT_THRESHOLDS = {
  priceIncreaseThreshold: 15, // 15% increase
  priceDecreaseThreshold: 15, // 15% decrease
  predictionThreshold: 10, // 10% predicted change
};

/**
 * Generates a unique alert ID.
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Price Alert Generator
 *
 * Analyzes price data and generates alerts based on configured thresholds.
 */
export class PriceAlertGenerator {
  private configs: Map<string, AlertConfig>;

  constructor() {
    this.configs = new Map();
  }

  /**
   * Adds or updates alert configuration for a crop.
   *
   * @param config - Alert configuration
   */
  setAlertConfig(config: AlertConfig): void {
    this.configs.set(config.cropId, config);
  }

  /**
   * Removes alert configuration for a crop.
   *
   * @param cropId - Crop ID
   */
  removeAlertConfig(cropId: string): void {
    this.configs.delete(cropId);
  }

  /**
   * Gets alert configuration for a crop.
   *
   * @param cropId - Crop ID
   * @returns Alert config or undefined
   */
  getAlertConfig(cropId: string): AlertConfig | undefined {
    return this.configs.get(cropId);
  }

  /**
   * Checks price data and generates alerts if thresholds are exceeded.
   *
   * @param stats - Current crop price statistics
   * @param history - Historical price data (optional, for predictions)
   * @returns Array of generated alerts
   */
  checkAndGenerateAlerts(stats: CropPriceStats, history?: PriceHistoryPoint[]): PriceAlert[] {
    const alerts: PriceAlert[] = [];
    const config = this.configs.get(stats.cropId) || {
      cropId: stats.cropId,
      ...DEFAULT_THRESHOLDS,
      enableBuyAlerts: true,
      enableSellAlerts: true,
      enablePredictionAlerts: true,
    };

    const priceIncreaseThreshold =
      config.priceIncreaseThreshold ?? DEFAULT_THRESHOLDS.priceIncreaseThreshold;
    const priceDecreaseThreshold =
      config.priceDecreaseThreshold ?? DEFAULT_THRESHOLDS.priceDecreaseThreshold;

    // Check for price spike
    if (stats.weeklyChange >= priceIncreaseThreshold) {
      alerts.push(this.createPriceSpikeAlert(stats));
    }

    // Check for price drop
    if (stats.weeklyChange <= -priceDecreaseThreshold) {
      alerts.push(this.createPriceDropAlert(stats));
    }

    // Check for opportunities if we have history
    if (history && history.length >= 14) {
      const opportunity = analyzePriceOpportunity(stats.currentPrice, history);

      if (opportunity.isOpportunity) {
        if (opportunity.type === 'buy' && (config.enableBuyAlerts ?? true)) {
          alerts.push(
            this.createBuyOpportunityAlert(stats, opportunity.reason, opportunity.percentFromAvg)
          );
        }
        if (opportunity.type === 'sell' && (config.enableSellAlerts ?? true)) {
          alerts.push(
            this.createSellOpportunityAlert(stats, opportunity.reason, opportunity.percentFromAvg)
          );
        }
      }

      // Check predictions
      if (config.enablePredictionAlerts ?? true) {
        const prediction = predictPrice(stats.cropName, history, 7);
        if (prediction) {
          const predictedChange =
            ((prediction.predictedPrice - stats.currentPrice) / stats.currentPrice) * 100;

          if (Math.abs(predictedChange) >= DEFAULT_THRESHOLDS.predictionThreshold) {
            alerts.push(this.createPredictionAlert(stats, prediction, predictedChange));
          }
        }
      }
    }

    return alerts;
  }

  /**
   * Generates alerts from a PriceTrend object (simpler interface).
   *
   * @param trend - Price trend data
   * @returns Array of generated alerts
   */
  checkTrendForAlerts(trend: PriceTrend): PriceAlert[] {
    const alerts: PriceAlert[] = [];
    const config = this.configs.get(trend.cropId) || {
      cropId: trend.cropId,
      ...DEFAULT_THRESHOLDS,
    };

    const priceIncreaseThreshold =
      config.priceIncreaseThreshold ?? DEFAULT_THRESHOLDS.priceIncreaseThreshold;
    const priceDecreaseThreshold =
      config.priceDecreaseThreshold ?? DEFAULT_THRESHOLDS.priceDecreaseThreshold;

    // Check weekly change
    if (trend.changePercent >= priceIncreaseThreshold) {
      alerts.push({
        id: generateAlertId(),
        type: 'price_spike',
        priority: trend.changePercent >= 25 ? 'high' : 'medium',
        cropId: trend.cropId,
        cropName: trend.cropId,
        title: '價格上漲',
        message: `${trend.cropId} 價格上漲 ${trend.changePercent.toFixed(1)}%`,
        currentPrice: trend.current,
        referencePrice: trend.weekAgo,
        changePercent: trend.changePercent,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
    }

    if (trend.changePercent <= -priceDecreaseThreshold) {
      alerts.push({
        id: generateAlertId(),
        type: 'price_drop',
        priority: trend.changePercent <= -25 ? 'high' : 'medium',
        cropId: trend.cropId,
        cropName: trend.cropId,
        title: '價格下跌',
        message: `${trend.cropId} 價格下跌 ${Math.abs(trend.changePercent).toFixed(1)}%`,
        currentPrice: trend.current,
        referencePrice: trend.weekAgo,
        changePercent: trend.changePercent,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    return alerts;
  }

  private createPriceSpikeAlert(stats: CropPriceStats): PriceAlert {
    return {
      id: generateAlertId(),
      type: 'price_spike',
      priority: stats.weeklyChange >= 25 ? 'high' : 'medium',
      cropId: stats.cropId,
      cropName: stats.cropName,
      title: '價格上漲提醒',
      message: `${stats.cropName} 價格較上週上漲 ${stats.weeklyChange.toFixed(1)}%，目前價格 ${stats.currentPrice.toFixed(1)} 元/公斤`,
      currentPrice: stats.currentPrice,
      referencePrice: stats.priceWeekAgo,
      changePercent: stats.weeklyChange,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private createPriceDropAlert(stats: CropPriceStats): PriceAlert {
    return {
      id: generateAlertId(),
      type: 'price_drop',
      priority: stats.weeklyChange <= -25 ? 'high' : 'medium',
      cropId: stats.cropId,
      cropName: stats.cropName,
      title: '價格下跌提醒',
      message: `${stats.cropName} 價格較上週下跌 ${Math.abs(stats.weeklyChange).toFixed(1)}%，目前價格 ${stats.currentPrice.toFixed(1)} 元/公斤`,
      currentPrice: stats.currentPrice,
      referencePrice: stats.priceWeekAgo,
      changePercent: stats.weeklyChange,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private createBuyOpportunityAlert(
    stats: CropPriceStats,
    reason: string,
    percentFromAvg: number
  ): PriceAlert {
    return {
      id: generateAlertId(),
      type: 'buy_opportunity',
      priority: percentFromAvg <= -20 ? 'high' : 'medium',
      cropId: stats.cropId,
      cropName: stats.cropName,
      title: '採購時機',
      message: `${stats.cropName} 目前價格低於平均 ${Math.abs(percentFromAvg).toFixed(1)}%，${reason}`,
      currentPrice: stats.currentPrice,
      referencePrice: stats.priceMonthAgo,
      changePercent: percentFromAvg,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
    };
  }

  private createSellOpportunityAlert(
    stats: CropPriceStats,
    reason: string,
    percentFromAvg: number
  ): PriceAlert {
    return {
      id: generateAlertId(),
      type: 'sell_opportunity',
      priority: percentFromAvg >= 25 ? 'high' : 'medium',
      cropId: stats.cropId,
      cropName: stats.cropName,
      title: '出貨時機',
      message: `${stats.cropName} 目前價格高於平均 ${percentFromAvg.toFixed(1)}%，${reason}`,
      currentPrice: stats.currentPrice,
      referencePrice: stats.priceMonthAgo,
      changePercent: percentFromAvg,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    };
  }

  private createPredictionAlert(
    stats: CropPriceStats,
    prediction: PricePrediction,
    predictedChange: number
  ): PriceAlert {
    const isIncrease = predictedChange > 0;
    const priority: AlertPriority = Math.abs(predictedChange) >= 20 ? 'high' : 'medium';

    return {
      id: generateAlertId(),
      type: 'price_prediction',
      priority,
      cropId: stats.cropId,
      cropName: stats.cropName,
      title: isIncrease ? '價格預測上漲' : '價格預測下跌',
      message: `預測 ${stats.cropName} 一週後價格將${isIncrease ? '上漲' : '下跌'} ${Math.abs(predictedChange).toFixed(1)}%，預測價格 ${prediction.predictedPrice.toFixed(1)} 元/公斤（信心度 ${(prediction.confidence * 100).toFixed(0)}%）`,
      currentPrice: stats.currentPrice,
      referencePrice: prediction.predictedPrice,
      changePercent: predictedChange,
      createdAt: new Date(),
      expiresAt: prediction.targetDate,
      metadata: {
        confidence: prediction.confidence,
        priceLow: prediction.priceLow,
        priceHigh: prediction.priceHigh,
        factors: prediction.factors,
      },
    };
  }
}

/**
 * Alert subscription for a user.
 */
export interface AlertSubscription {
  /** User ID */
  userId: string;
  /** Crops to monitor */
  cropIds: string[];
  /** Alert types to receive */
  alertTypes: AlertType[];
  /** Minimum priority to receive */
  minPriority: AlertPriority;
  /** Whether the subscription is active */
  isActive: boolean;
}

/**
 * Storage interface for alert subscriptions.
 */
export interface AlertSubscriptionStorage {
  getByUserId(userId: string): Promise<AlertSubscription | null>;
  save(subscription: AlertSubscription): Promise<void>;
  getActiveSubscriptions(): Promise<AlertSubscription[]>;
  delete(userId: string): Promise<void>;
}

/**
 * In-memory implementation of AlertSubscriptionStorage.
 */
export class InMemoryAlertSubscriptionStorage implements AlertSubscriptionStorage {
  private subscriptions: Map<string, AlertSubscription> = new Map();

  async getByUserId(userId: string): Promise<AlertSubscription | null> {
    return this.subscriptions.get(userId) || null;
  }

  async save(subscription: AlertSubscription): Promise<void> {
    this.subscriptions.set(subscription.userId, subscription);
  }

  async getActiveSubscriptions(): Promise<AlertSubscription[]> {
    return Array.from(this.subscriptions.values()).filter((s) => s.isActive);
  }

  async delete(userId: string): Promise<void> {
    this.subscriptions.delete(userId);
  }
}

/**
 * Creates a PriceAlertGenerator instance.
 */
export function createPriceAlertGenerator(): PriceAlertGenerator {
  return new PriceAlertGenerator();
}
