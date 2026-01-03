/**
 * Harvest Prediction Module
 *
 * Predicts harvest dates based on planting date, crop characteristics,
 * regional data, and weather conditions. Uses a climate adjustment factor
 * to account for temperature, rainfall, and regional variations.
 */

import type { CropInfo, HarvestPrediction, TaiwanRegion } from '@minori/shared';
import { getRegionalAdjustment } from '../crops/crop-database';

/**
 * Weather data for a specific date.
 */
export interface WeatherData {
  date: Date;
  temperatureMin: number;
  temperatureMax: number;
  rainfall: number;
  /** Optional humidity percentage (0-100) */
  humidity?: number;
}

/**
 * Options for harvest prediction.
 */
export interface PredictionOptions {
  /** Weather forecast data */
  weather?: WeatherData[];
  /** Taiwan region for regional adjustments */
  region?: TaiwanRegion;
  /** Whether to use regional growth adjustments */
  useRegionalAdjustments?: boolean;
}

/**
 * Detailed factors that influenced the prediction.
 */
export interface PredictionFactors {
  /** Base growth days from crop data */
  baseGrowthDays: number;
  /** Regional adjustment in days (positive = longer) */
  regionalAdjustment: number;
  /** Temperature-based adjustment factor */
  temperatureAdjustment: number;
  /** Rainfall-based adjustment factor */
  rainfallAdjustment: number;
  /** Combined adjustment factor */
  totalAdjustment: number;
}

/**
 * Calculates the climate adjustment factor based on weather data.
 *
 * The adjustment factor modifies the base growth days:
 * - Temperature below optimal: growth slows (factor > 1)
 * - Temperature above optimal: slight slowdown (factor > 1)
 * - High rainfall: potential delay (factor increases)
 * - Temperature extremes: significant delays
 *
 * @param crop - Crop information with growth parameters
 * @param weather - Array of weather forecast data
 * @returns Object with temperature and rainfall adjustment factors
 */
function calculateClimateAdjustment(
  crop: CropInfo,
  weather: WeatherData[]
): { tempFactor: number; rainFactor: number } {
  if (weather.length === 0) {
    return { tempFactor: 1, rainFactor: 1 };
  }

  // Calculate average temperature
  const avgTemp =
    weather.reduce((sum, w) => sum + (w.temperatureMin + w.temperatureMax) / 2, 0) / weather.length;

  // Calculate min and max temperatures across the period
  const minTemp = Math.min(...weather.map((w) => w.temperatureMin));
  const maxTemp = Math.max(...weather.map((w) => w.temperatureMax));

  // Temperature factor: growth slows when temp deviates from optimal
  let tempFactor = 1;

  // Check for extreme temperatures that halt or severely slow growth
  if (minTemp < crop.growth.temperatureMin) {
    // Below minimum growing temperature - significant delay
    tempFactor += (crop.growth.temperatureMin - minTemp) * 0.05;
  }

  if (maxTemp > crop.growth.temperatureMax) {
    // Above maximum growing temperature - heat stress delay
    tempFactor += (maxTemp - crop.growth.temperatureMax) * 0.03;
  }

  // Normal temperature deviation from optimal
  if (avgTemp < crop.growth.temperatureOptimal) {
    tempFactor += (crop.growth.temperatureOptimal - avgTemp) * 0.015;
  } else if (avgTemp > crop.growth.temperatureOptimal) {
    tempFactor += (avgTemp - crop.growth.temperatureOptimal) * 0.01;
  }

  // Rainfall factor: both excessive and insufficient rain affect growth
  const totalRain = weather.reduce((sum, w) => sum + w.rainfall, 0);
  const avgDailyRain = totalRain / weather.length;

  let rainFactor = 1;

  if (avgDailyRain > 30) {
    // Excessive rain (>30mm/day average) - waterlogging, disease risk
    rainFactor = 1 + (avgDailyRain - 30) * 0.005;
  } else if (avgDailyRain < 2 && weather.length > 7) {
    // Drought conditions - growth slowdown
    rainFactor = 1 + (2 - avgDailyRain) * 0.05;
  }

  // Cap factors at reasonable limits
  tempFactor = Math.min(tempFactor, 1.5);
  rainFactor = Math.min(rainFactor, 1.3);

  return { tempFactor, rainFactor };
}

/**
 * Calculates a confidence score based on the quality and completeness of input data.
 *
 * @param weather - Weather data array
 * @param region - Optional region
 * @param crop - Crop information
 * @returns Confidence score between 0 and 1
 */
function calculateConfidence(
  weather: WeatherData[],
  region: TaiwanRegion | undefined,
  crop: CropInfo
): number {
  let confidence = 0.5; // Base confidence

  // Weather data quality bonus
  if (weather.length > 0) {
    // More weather data = higher confidence
    const weatherBonus = Math.min(weather.length / 14, 0.2); // Max 0.2 for 14+ days
    confidence += weatherBonus;

    // Recent weather data is more reliable
    const now = new Date();
    const firstDate = weather[0]!.date;
    const daysDiff = Math.abs((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      confidence += 0.1; // Fresh forecast bonus
    }
  }

  // Regional data bonus
  if (region) {
    const regionalAdj = getRegionalAdjustment(crop.id, region);
    if (regionalAdj) {
      confidence += 0.1; // Have specific regional data
    }
  }

  // Crop-specific reliability
  // Some crops have more predictable growth cycles
  const varianceRatio = (crop.growth.daysMax - crop.growth.daysMin) / crop.growth.daysOptimal;
  if (varianceRatio < 0.3) {
    confidence += 0.1; // Predictable crop
  } else if (varianceRatio > 0.5) {
    confidence -= 0.1; // Highly variable crop
  }

  return Math.max(0.3, Math.min(confidence, 0.95));
}

/**
 * Adds days to a date.
 *
 * @param date - Base date
 * @param days - Number of days to add
 * @returns New date with days added
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + Math.round(days));
  return result;
}

/**
 * Predicts harvest date based on planting date, weather data, and regional factors.
 *
 * @param crop - Crop information from the database
 * @param plantingDate - Date when the crop was planted
 * @param options - Optional prediction configuration
 * @returns Harvest prediction with date range, confidence score, and detailed factors
 *
 * @example
 * ```typescript
 * const crop = getCropById('bok-choy');
 * const prediction = predictHarvest(crop, new Date('2025-01-02'), {
 *   region: 'central',
 *   weather: weatherData
 * });
 * console.log(prediction.predictions.likely); // Expected harvest date
 * ```
 */
export function predictHarvest(
  crop: CropInfo,
  plantingDate: Date,
  options: PredictionOptions = {}
): HarvestPrediction {
  const { weather = [], region, useRegionalAdjustments = true } = options;

  // Get base growth days
  let baseDays = crop.growth.daysOptimal;
  let daysMin = crop.growth.daysMin;
  let daysMax = crop.growth.daysMax;

  // Apply regional adjustments if available
  let regionalDaysAdjustment = 0;
  if (useRegionalAdjustments && region) {
    const regionalAdj = getRegionalAdjustment(crop.id, region);
    if (regionalAdj?.daysAdjustment) {
      regionalDaysAdjustment = regionalAdj.daysAdjustment;
      baseDays += regionalDaysAdjustment;
      daysMin += regionalDaysAdjustment;
      daysMax += regionalDaysAdjustment;
    }
  }

  // Calculate climate adjustments
  const { tempFactor, rainFactor } = calculateClimateAdjustment(crop, weather);
  const totalAdjustment = tempFactor * rainFactor;

  // Calculate confidence
  const confidence = calculateConfidence(weather, region, crop);

  return {
    cropId: crop.id,
    plantingDate,
    predictions: {
      earliest: addDays(plantingDate, daysMin * totalAdjustment),
      likely: addDays(plantingDate, baseDays * totalAdjustment),
      latest: addDays(plantingDate, daysMax * totalAdjustment),
    },
    confidence,
    factors: {
      baseGrowthDays: crop.growth.daysOptimal,
      temperatureAdjustment: tempFactor,
      rainfallAdjustment: rainFactor,
    },
  };
}

/**
 * Predicts harvest with automatic weather data fetching.
 * This is a convenience wrapper that integrates with the WeatherService.
 *
 * @param crop - Crop information from the database
 * @param plantingDate - Date when the crop was planted
 * @param region - Taiwan region for weather data and regional adjustments
 * @param weatherService - Optional WeatherService instance for fetching weather
 * @returns Promise resolving to harvest prediction
 *
 * @example
 * ```typescript
 * const crop = getCropById('tomato');
 * const prediction = await predictHarvestWithWeather(
 *   crop,
 *   new Date('2025-01-02'),
 *   'south',
 *   weatherService
 * );
 * ```
 */
export async function predictHarvestWithWeather(
  crop: CropInfo,
  plantingDate: Date,
  region: TaiwanRegion,
  weatherService?: {
    getExtendedForecast: (region: TaiwanRegion, days: number) => Promise<WeatherData[]>;
  }
): Promise<HarvestPrediction> {
  let weather: WeatherData[] = [];

  if (weatherService) {
    try {
      // Fetch weather for the expected growth period
      weather = await weatherService.getExtendedForecast(region, crop.growth.daysOptimal);
    } catch {
      // Continue without weather data if service fails
      console.warn('Failed to fetch weather data, using base prediction');
    }
  }

  return predictHarvest(crop, plantingDate, { weather, region });
}
