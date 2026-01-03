/**
 * Price Module
 *
 * Agricultural price data services for Taiwan markets.
 * Includes:
 * - MOA API client for fetching market prices
 * - Price service with caching and trend analysis
 * - Price prediction using statistical methods
 * - Price alert system for farmers
 */

// MOA API Client
export {
  MOAClient,
  MOAClientError,
  toROCDate,
  fromROCDate,
  TAIWAN_MARKETS,
  type MOARawPriceData,
  type PriceData,
  type PriceQueryOptions,
} from './moa-client';

// Price Service
export {
  PriceService,
  createPriceService,
  type PriceServiceConfig,
  type CropPriceStats,
  type MarketPriceComparison,
  type PriceHistoryPoint,
} from './price-service';

// Price Prediction
export {
  predictPrice,
  analyzePriceOpportunity,
  type PricePrediction,
  type PricePredictionFactors,
} from './price-prediction';

// Price Alerts
export {
  PriceAlertGenerator,
  InMemoryAlertSubscriptionStorage,
  createPriceAlertGenerator,
  type AlertType,
  type AlertPriority,
  type PriceAlert,
  type AlertConfig,
  type AlertSubscription,
  type AlertSubscriptionStorage,
} from './price-alert';
