/**
 * Prediction Validation Module
 *
 * Tracks and validates harvest predictions against actual harvest dates.
 * Provides metrics for evaluating prediction accuracy and improving the model.
 */

import type { HarvestPrediction, TaiwanRegion, Season } from '@minori/shared';

/**
 * Record of a prediction that has been validated against actual data.
 */
export interface ValidationRecord {
  /** Unique identifier for this validation record */
  id: string;
  /** Crop identifier */
  cropId: string;
  /** Region where the crop was grown */
  region?: TaiwanRegion;
  /** Season during which the crop was grown */
  season?: Season;
  /** The original prediction */
  prediction: HarvestPrediction;
  /** Actual harvest date */
  actualHarvestDate: Date;
  /** Error in days (positive = harvested later than predicted) */
  errorDays: number;
  /** Whether the prediction was within acceptable range (±7 days) */
  isAccurate: boolean;
  /** Timestamp when this validation was recorded */
  validatedAt: Date;
  /** Optional notes about conditions */
  notes?: string;
}

/**
 * Aggregated accuracy metrics.
 */
export interface AccuracyMetrics {
  /** Total number of validated predictions */
  totalPredictions: number;
  /** Number of predictions within ±7 days */
  accuratePredictions: number;
  /** Accuracy rate (0-1) */
  accuracyRate: number;
  /** Mean absolute error in days */
  meanAbsoluteError: number;
  /** Root mean squared error in days */
  rmse: number;
  /** Mean error (positive = predictions tend to be early) */
  meanError: number;
  /** Standard deviation of errors */
  errorStdDev: number;
}

/**
 * Metrics breakdown by category.
 */
export interface MetricsBreakdown {
  /** Overall metrics */
  overall: AccuracyMetrics;
  /** Metrics by crop */
  byCrop: Map<string, AccuracyMetrics>;
  /** Metrics by region */
  byRegion: Map<TaiwanRegion, AccuracyMetrics>;
  /** Metrics by season */
  bySeason: Map<Season, AccuracyMetrics>;
}

/**
 * Storage interface for validation records.
 */
export interface ValidationStorage {
  save(record: ValidationRecord): Promise<void>;
  getById(id: string): Promise<ValidationRecord | null>;
  getAll(): Promise<ValidationRecord[]>;
  getByCrop(cropId: string): Promise<ValidationRecord[]>;
  getByRegion(region: TaiwanRegion): Promise<ValidationRecord[]>;
  getBySeason(season: Season): Promise<ValidationRecord[]>;
  getRecent(count: number): Promise<ValidationRecord[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory implementation of ValidationStorage.
 */
export class InMemoryValidationStorage implements ValidationStorage {
  private records: Map<string, ValidationRecord> = new Map();

  async save(record: ValidationRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async getById(id: string): Promise<ValidationRecord | null> {
    return this.records.get(id) || null;
  }

  async getAll(): Promise<ValidationRecord[]> {
    return Array.from(this.records.values());
  }

  async getByCrop(cropId: string): Promise<ValidationRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.cropId === cropId);
  }

  async getByRegion(region: TaiwanRegion): Promise<ValidationRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.region === region);
  }

  async getBySeason(season: Season): Promise<ValidationRecord[]> {
    return Array.from(this.records.values()).filter((r) => r.season === season);
  }

  async getRecent(count: number): Promise<ValidationRecord[]> {
    return Array.from(this.records.values())
      .sort((a, b) => b.validatedAt.getTime() - a.validatedAt.getTime())
      .slice(0, count);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}

/**
 * Calculates the difference in days between two dates.
 */
function daysDifference(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((date1.getTime() - date2.getTime()) / msPerDay);
}

/**
 * Generates a unique ID for a validation record.
 */
function generateId(): string {
  return `val_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Determines the season for a given date.
 */
function getSeasonForDate(date: Date): Season {
  const month = date.getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

/**
 * Calculates accuracy metrics from a set of validation records.
 */
function calculateMetrics(records: ValidationRecord[]): AccuracyMetrics {
  if (records.length === 0) {
    return {
      totalPredictions: 0,
      accuratePredictions: 0,
      accuracyRate: 0,
      meanAbsoluteError: 0,
      rmse: 0,
      meanError: 0,
      errorStdDev: 0,
    };
  }

  const errors = records.map((r) => r.errorDays);
  const absErrors = errors.map((e) => Math.abs(e));
  const squaredErrors = errors.map((e) => e * e);

  const totalPredictions = records.length;
  const accuratePredictions = records.filter((r) => r.isAccurate).length;
  const accuracyRate = accuratePredictions / totalPredictions;

  const meanAbsoluteError = absErrors.reduce((a, b) => a + b, 0) / totalPredictions;
  const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / totalPredictions);
  const meanError = errors.reduce((a, b) => a + b, 0) / totalPredictions;

  // Calculate standard deviation
  const variance =
    errors.reduce((sum, e) => sum + Math.pow(e - meanError, 2), 0) / totalPredictions;
  const errorStdDev = Math.sqrt(variance);

  return {
    totalPredictions,
    accuratePredictions,
    accuracyRate,
    meanAbsoluteError,
    rmse,
    meanError,
    errorStdDev,
  };
}

/**
 * Prediction Validator for tracking and analyzing prediction accuracy.
 */
export class PredictionValidator {
  private storage: ValidationStorage;
  /** Threshold in days for considering a prediction "accurate" */
  private accuracyThreshold: number;

  constructor(storage?: ValidationStorage, accuracyThreshold = 7) {
    this.storage = storage || new InMemoryValidationStorage();
    this.accuracyThreshold = accuracyThreshold;
  }

  /**
   * Validates a prediction against the actual harvest date.
   *
   * @param prediction - The original harvest prediction
   * @param actualHarvestDate - The actual date the crop was harvested
   * @param options - Additional context (region, notes)
   * @returns The validation record
   */
  async validate(
    prediction: HarvestPrediction,
    actualHarvestDate: Date,
    options: { region?: TaiwanRegion; notes?: string } = {}
  ): Promise<ValidationRecord> {
    const errorDays = daysDifference(actualHarvestDate, prediction.predictions.likely);
    const isAccurate = Math.abs(errorDays) <= this.accuracyThreshold;

    const record: ValidationRecord = {
      id: generateId(),
      cropId: prediction.cropId,
      region: options.region,
      season: getSeasonForDate(prediction.plantingDate),
      prediction,
      actualHarvestDate,
      errorDays,
      isAccurate,
      validatedAt: new Date(),
      notes: options.notes,
    };

    await this.storage.save(record);
    return record;
  }

  /**
   * Gets overall accuracy metrics.
   */
  async getOverallMetrics(): Promise<AccuracyMetrics> {
    const records = await this.storage.getAll();
    return calculateMetrics(records);
  }

  /**
   * Gets accuracy metrics broken down by crop, region, and season.
   */
  async getMetricsBreakdown(): Promise<MetricsBreakdown> {
    const records = await this.storage.getAll();

    // Group by crop
    const byCropMap = new Map<string, ValidationRecord[]>();
    for (const record of records) {
      const existing = byCropMap.get(record.cropId) || [];
      existing.push(record);
      byCropMap.set(record.cropId, existing);
    }
    const byCrop = new Map<string, AccuracyMetrics>();
    for (const [cropId, cropRecords] of byCropMap) {
      byCrop.set(cropId, calculateMetrics(cropRecords));
    }

    // Group by region
    const byRegionMap = new Map<TaiwanRegion, ValidationRecord[]>();
    for (const record of records) {
      if (record.region) {
        const existing = byRegionMap.get(record.region) || [];
        existing.push(record);
        byRegionMap.set(record.region, existing);
      }
    }
    const byRegion = new Map<TaiwanRegion, AccuracyMetrics>();
    for (const [region, regionRecords] of byRegionMap) {
      byRegion.set(region, calculateMetrics(regionRecords));
    }

    // Group by season
    const bySeasonMap = new Map<Season, ValidationRecord[]>();
    for (const record of records) {
      if (record.season) {
        const existing = bySeasonMap.get(record.season) || [];
        existing.push(record);
        bySeasonMap.set(record.season, existing);
      }
    }
    const bySeason = new Map<Season, AccuracyMetrics>();
    for (const [season, seasonRecords] of bySeasonMap) {
      bySeason.set(season, calculateMetrics(seasonRecords));
    }

    return {
      overall: calculateMetrics(records),
      byCrop,
      byRegion,
      bySeason,
    };
  }

  /**
   * Gets accuracy metrics for a specific crop.
   */
  async getCropMetrics(cropId: string): Promise<AccuracyMetrics> {
    const records = await this.storage.getByCrop(cropId);
    return calculateMetrics(records);
  }

  /**
   * Gets accuracy metrics for a specific region.
   */
  async getRegionMetrics(region: TaiwanRegion): Promise<AccuracyMetrics> {
    const records = await this.storage.getByRegion(region);
    return calculateMetrics(records);
  }

  /**
   * Gets recent validation records.
   */
  async getRecentValidations(count = 10): Promise<ValidationRecord[]> {
    return this.storage.getRecent(count);
  }

  /**
   * Checks if the prediction model meets the accuracy target.
   *
   * @param targetAccuracy - Required accuracy rate (default: 0.8 = 80%)
   * @param minSamples - Minimum number of samples required (default: 10)
   * @returns Object with pass/fail status and current metrics
   */
  async checkAccuracyTarget(
    targetAccuracy = 0.8,
    minSamples = 10
  ): Promise<{
    passes: boolean;
    metrics: AccuracyMetrics;
    message: string;
  }> {
    const metrics = await this.getOverallMetrics();

    if (metrics.totalPredictions < minSamples) {
      return {
        passes: false,
        metrics,
        message: `Insufficient data: ${metrics.totalPredictions}/${minSamples} samples`,
      };
    }

    const passes = metrics.accuracyRate >= targetAccuracy;
    const message = passes
      ? `Accuracy target met: ${(metrics.accuracyRate * 100).toFixed(1)}% >= ${targetAccuracy * 100}%`
      : `Accuracy below target: ${(metrics.accuracyRate * 100).toFixed(1)}% < ${targetAccuracy * 100}%`;

    return { passes, metrics, message };
  }

  /**
   * Clears all validation records.
   */
  async clearAll(): Promise<void> {
    await this.storage.clear();
  }
}

/**
 * Creates a PredictionValidator with optional custom storage.
 */
export function createPredictionValidator(
  storage?: ValidationStorage,
  accuracyThreshold = 7
): PredictionValidator {
  return new PredictionValidator(storage, accuracyThreshold);
}
