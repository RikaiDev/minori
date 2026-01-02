/**
 * Harvest Prediction Module
 *
 * Predicts harvest dates based on planting date, crop characteristics,
 * and weather data. Uses a climate adjustment factor to account for
 * temperature and rainfall variations.
 */

import type { CropInfo, HarvestPrediction } from '@minori/shared';

export interface WeatherData {
  date: Date;
  temperatureMin: number;
  temperatureMax: number;
  rainfall: number;
}

/**
 * Calculates the climate adjustment factor based on weather data.
 *
 * The adjustment factor modifies the base growth days:
 * - Temperature below optimal: growth slows (factor > 1)
 * - Temperature above optimal: slight slowdown (factor > 1)
 * - High rainfall: potential delay (factor increases)
 *
 * @param crop - Crop information with growth parameters
 * @param weather - Array of weather forecast data
 * @returns Adjustment factor (1.0 = no adjustment, >1.0 = slower growth)
 */
function calculateClimateAdjustment(
  crop: CropInfo,
  weather: WeatherData[]
): number {
  if (weather.length === 0) return 1;

  const avgTemp =
    weather.reduce((sum, w) => sum + (w.temperatureMin + w.temperatureMax) / 2, 0) /
    weather.length;

  // Temperature factor: growth slows when temp deviates from optimal
  let tempFactor = 1;
  if (avgTemp < crop.growth.temperatureOptimal) {
    tempFactor = 1 + (crop.growth.temperatureOptimal - avgTemp) * 0.02;
  } else if (avgTemp > crop.growth.temperatureOptimal) {
    tempFactor = 1 + (avgTemp - crop.growth.temperatureOptimal) * 0.01;
  }

  // Rainfall factor: excessive rain may delay harvest
  const totalRain = weather.reduce((sum, w) => sum + w.rainfall, 0);
  const rainFactor = totalRain > 200 ? 1.1 : 1;

  // Cap the adjustment at 50% delay
  return Math.min(tempFactor * rainFactor, 1.5);
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
 * Predicts harvest date based on planting date and optional weather data.
 *
 * @param crop - Crop information from the database
 * @param plantingDate - Date when the crop was planted
 * @param weather - Optional weather forecast data for more accurate prediction
 * @returns Harvest prediction with date range and confidence score
 *
 * @example
 * ```typescript
 * const crop = getCropById('bok-choy');
 * const prediction = predictHarvest(crop, new Date('2025-01-02'));
 * console.log(prediction.predictions.likely); // Expected harvest date
 * ```
 */
export function predictHarvest(
  crop: CropInfo,
  plantingDate: Date,
  weather: WeatherData[] = []
): HarvestPrediction {
  const adjustment = calculateClimateAdjustment(crop, weather);

  return {
    cropId: crop.id,
    plantingDate,
    predictions: {
      earliest: addDays(plantingDate, crop.growth.daysMin * adjustment),
      likely: addDays(plantingDate, crop.growth.daysOptimal * adjustment),
      latest: addDays(plantingDate, crop.growth.daysMax * adjustment),
    },
    confidence: weather.length > 0 ? 0.85 : 0.7,
    factors: {
      baseGrowthDays: crop.growth.daysOptimal,
      temperatureAdjustment: adjustment,
      rainfallAdjustment: 1,
    },
  };
}
