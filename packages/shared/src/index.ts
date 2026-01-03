/**
 * @minori/shared
 *
 * Shared types, utilities, and internationalization for the minori platform.
 */

// ============================================================
// Internationalization
// ============================================================

export * from './i18n';

// ============================================================
// Crop Types
// ============================================================

export type CropCategory = 'leafy' | 'root' | 'gourd' | 'fruit' | 'grain' | 'herb' | 'legume';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * Taiwan agricultural regions for regional variations.
 */
export type TaiwanRegion = 'north' | 'central' | 'south' | 'east';

/**
 * Regional adjustment for crop growth parameters.
 */
export interface RegionalAdjustment {
  region: TaiwanRegion;
  /** Days adjustment (positive = longer, negative = shorter) */
  daysAdjustment?: number;
  /** Season overrides for this region */
  seasons?: Season[];
  /** Yield multiplier (1.0 = no change, 1.2 = 20% more) */
  yieldMultiplier?: number;
  /** Region-specific notes */
  notes?: string;
}

export interface CropInfo {
  id: string;
  name: string;
  aliases: string[];
  category: CropCategory;
  growth: {
    daysMin: number;
    daysMax: number;
    daysOptimal: number;
    temperatureMin: number;
    temperatureMax: number;
    temperatureOptimal: number;
  };
  seasons: Season[];
  yield: {
    perArea: number; // Yield per plot (kg)
    variance: number;
  };
  commonPests: string[];
  /** Common diseases affecting this crop */
  commonDiseases?: string[];
  /** Regional variations for different parts of Taiwan */
  regions?: RegionalAdjustment[];
  /** Planting tips and best practices */
  plantingTips?: string[];
  notes?: string;
}

// ============================================================
// Intent Types
// ============================================================

export type IntentAction =
  | 'record_planting'
  | 'record_growth'
  | 'record_harvest'
  | 'query_crops'
  | 'query_forecast'
  | 'query_price'
  | 'query_member_crops'
  | 'query_supply'
  | 'export_report'
  | 'confirm'
  | 'cancel'
  | 'help'
  | 'unknown';

export type AreaUnit = 'plot' | 'jia' | 'ping' | 'hectare';
export type QuantityUnit = 'kg' | 'jin' | 'taiwanJin';

export interface ParsedEntities {
  crop?: string;
  cropId?: string;
  area?: number;
  areaUnit?: AreaUnit;
  quantity?: number;
  quantityUnit?: QuantityUnit;
  date?: Date;
  dateExpression?: string;
  condition?: string;
}

export interface ParsedIntent {
  action: IntentAction;
  entities: ParsedEntities;
  confidence: number;
  rawText: string;
}

// ============================================================
// Field Record Types
// ============================================================

export type FieldAction = 'planting' | 'growth' | 'harvest';

export interface FieldRecord {
  id: string;
  farmerId: string;
  cropId: string;
  action: FieldAction;
  areaSize?: number;
  quantity?: number;
  recordedAt: Date;
  predictedHarvestDate?: Date;
  actualHarvestDate?: Date;
  predictedYield?: number;
  actualYield?: number;
  notes?: string;
  images?: string[];
  createdAt: Date;
}

// ============================================================
// Prediction Types
// ============================================================

export interface HarvestPrediction {
  cropId: string;
  plantingDate: Date;
  predictions: {
    earliest: Date;
    likely: Date;
    latest: Date;
  };
  confidence: number;
  factors: {
    baseGrowthDays: number;
    temperatureAdjustment: number;
    rainfallAdjustment: number;
  };
}

export interface PriceTrend {
  cropId: string;
  current: number;
  weekAgo: number;
  monthAgo: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

// ============================================================
// User Types
// ============================================================

export type UserRole = 'farmer' | 'cooperative' | 'customer';

export interface User {
  id: string;
  lineUserId: string;
  role: UserRole;
  cooperativeId: string;
  name?: string;
  locale?: 'en' | 'zh-TW';
  createdAt: Date;
}

// ============================================================
// Cooperative Types
// ============================================================

/**
 * Summary of a single crop across all members.
 */
export interface CropSummary {
  cropId: string;
  cropName: string;
  totalArea: number;
  farmerCount: number;
  estimatedYield: number;
  estimatedHarvestDate: Date;
  confidence: number;
}

/**
 * Supply availability for a time period.
 */
export interface SupplyItem {
  cropId: string;
  cropName: string;
  estimatedQuantity: number;
  farmerCount: number;
  earliestDate: Date;
  latestDate: Date;
  farmers: Array<{
    farmerId: string;
    farmerName: string;
    quantity: number;
    harvestDate: Date;
  }>;
}

/**
 * Member crop report for a cooperative.
 */
export interface MemberCropReport {
  cooperativeId: string;
  generatedAt: Date;
  totalFarmers: number;
  totalArea: number;
  crops: CropSummary[];
}

/**
 * Supply availability report for a time period.
 */
export interface SupplyReport {
  cooperativeId: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  items: SupplyItem[];
}

/**
 * Export format for reports.
 */
export type ExportFormat = 'xlsx' | 'csv' | 'json';

/**
 * Report type for export.
 */
export type ReportType = 'member_crops' | 'supply' | 'harvest_history';

// ============================================================
// Utility Functions
// ============================================================

/**
 * Converts area to plots (分地)
 *
 * Conversion rates:
 * - 1 jia (甲) = 10 plots
 * - 1 hectare ≈ 10.31 plots
 * - 2934 ping (坪) = 10 plots
 */
export function convertToPlots(value: number, unit: AreaUnit): number {
  switch (unit) {
    case 'plot':
      return value;
    case 'jia':
      return value * 10;
    case 'ping':
      return value / 293.4;
    case 'hectare':
      return value * 10.31;
    default:
      return value;
  }
}

/**
 * Converts weight to kilograms
 *
 * Conversion rates:
 * - 1 jin (斤) = 0.5 kg
 * - 1 Taiwan jin (台斤) = 0.6 kg
 */
export function convertToKg(value: number, unit: QuantityUnit): number {
  switch (unit) {
    case 'kg':
      return value;
    case 'jin':
      return value * 0.5;
    case 'taiwanJin':
      return value * 0.6;
    default:
      return value;
  }
}

/**
 * Formats a date to MM/DD format
 */
export function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
