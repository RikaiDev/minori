/**
 * Weather Service
 *
 * High-level service for fetching and processing weather data for agricultural use.
 * Provides weather forecasts in a format suitable for harvest prediction.
 */

import type { TaiwanRegion } from '@minori/shared';
import { CWAClient, CWAClientError, type CWAWeatherForecast } from './cwa-client';
import type { WeatherData } from '../prediction/harvest-predictor';

/**
 * Configuration options for WeatherService.
 */
export interface WeatherServiceConfig {
  /** CWA API key (optional, will use env var if not provided) */
  apiKey?: string;
  /** Enable caching of weather data */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 1 hour) */
  cacheTTL?: number;
}

/**
 * Cached weather data entry.
 */
interface CacheEntry {
  data: WeatherData[];
  timestamp: number;
}

/**
 * Weather service for fetching and managing weather data.
 */
export class WeatherService {
  private client: CWAClient;
  private cache: Map<string, CacheEntry>;
  private cacheTTL: number;
  private enableCache: boolean;

  constructor(config: WeatherServiceConfig = {}) {
    this.client = new CWAClient(config.apiKey);
    this.cache = new Map();
    this.enableCache = config.enableCache ?? true;
    this.cacheTTL = config.cacheTTL ?? 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Checks if the weather service is available (has API key configured).
   */
  isAvailable(): boolean {
    return this.client.hasApiKey();
  }

  /**
   * Fetches weather forecast for a Taiwan region.
   * Returns data in the format expected by harvest predictor.
   *
   * @param region - Taiwan region (north, central, south, east)
   * @returns Array of weather data for the forecast period
   */
  async getWeatherForecast(region: TaiwanRegion): Promise<WeatherData[]> {
    const cacheKey = `forecast:${region}`;

    // Check cache first
    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const forecasts = await this.client.getRegionalForecast(region);
      const weatherData = this.convertToWeatherData(forecasts);

      // Update cache
      if (this.enableCache) {
        this.cache.set(cacheKey, {
          data: weatherData,
          timestamp: Date.now(),
        });
      }

      return weatherData;
    } catch (error) {
      if (error instanceof CWAClientError) {
        // Log error but return empty array to allow fallback behavior
        console.warn(`Weather service error: ${error.message} (${error.code})`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Gets extended weather forecast by combining actual forecast with
   * historical averages for dates beyond the forecast period.
   *
   * @param region - Taiwan region
   * @param days - Number of days of weather data needed
   * @returns Combined weather data array
   */
  async getExtendedForecast(region: TaiwanRegion, days: number): Promise<WeatherData[]> {
    const forecast = await this.getWeatherForecast(region);

    if (forecast.length >= days) {
      return forecast.slice(0, days);
    }

    // For days beyond the forecast, use regional averages
    const averages = this.getRegionalAverages(region);
    const extended: WeatherData[] = [...forecast];

    const lastDate = forecast.length > 0 ? forecast[forecast.length - 1]!.date : new Date();

    for (let i = forecast.length; i < days; i++) {
      const date = new Date(lastDate);
      date.setDate(date.getDate() + (i - forecast.length + 1));

      // Get seasonal averages based on month
      const monthAverages = averages[date.getMonth()] || averages[0]!;

      extended.push({
        date,
        temperatureMin: monthAverages.temperatureMin,
        temperatureMax: monthAverages.temperatureMax,
        rainfall: monthAverages.rainfall,
      });
    }

    return extended;
  }

  /**
   * Converts CWA forecast data to the WeatherData format.
   */
  private convertToWeatherData(forecasts: CWAWeatherForecast[]): WeatherData[] {
    return forecasts.map((f) => ({
      date: f.date,
      temperatureMin: f.temperatureMin,
      temperatureMax: f.temperatureMax,
      rainfall: f.rainfall,
    }));
  }

  /**
   * Gets monthly average weather data for a region.
   * Based on Taiwan climate data.
   */
  private getRegionalAverages(region: TaiwanRegion): Array<{
    temperatureMin: number;
    temperatureMax: number;
    rainfall: number;
  }> {
    // Monthly averages (index 0 = January, 11 = December)
    // Data based on Taiwan climate statistics
    const regionAverages: Record<
      TaiwanRegion,
      Array<{ temperatureMin: number; temperatureMax: number; rainfall: number }>
    > = {
      north: [
        { temperatureMin: 12, temperatureMax: 18, rainfall: 90 }, // Jan
        { temperatureMin: 12, temperatureMax: 19, rainfall: 150 }, // Feb
        { temperatureMin: 14, temperatureMax: 21, rainfall: 180 }, // Mar
        { temperatureMin: 17, temperatureMax: 25, rainfall: 180 }, // Apr
        { temperatureMin: 21, temperatureMax: 28, rainfall: 250 }, // May
        { temperatureMin: 24, temperatureMax: 31, rainfall: 320 }, // Jun
        { temperatureMin: 26, temperatureMax: 33, rainfall: 240 }, // Jul
        { temperatureMin: 26, temperatureMax: 33, rainfall: 300 }, // Aug
        { temperatureMin: 24, temperatureMax: 31, rainfall: 280 }, // Sep
        { temperatureMin: 21, temperatureMax: 27, rainfall: 150 }, // Oct
        { temperatureMin: 17, temperatureMax: 24, rainfall: 100 }, // Nov
        { temperatureMin: 14, temperatureMax: 20, rainfall: 80 }, // Dec
      ],
      central: [
        { temperatureMin: 13, temperatureMax: 22, rainfall: 30 }, // Jan
        { temperatureMin: 13, temperatureMax: 23, rainfall: 60 }, // Feb
        { temperatureMin: 16, temperatureMax: 26, rainfall: 80 }, // Mar
        { temperatureMin: 19, temperatureMax: 29, rainfall: 120 }, // Apr
        { temperatureMin: 23, temperatureMax: 31, rainfall: 200 }, // May
        { temperatureMin: 25, temperatureMax: 32, rainfall: 350 }, // Jun
        { temperatureMin: 26, temperatureMax: 33, rainfall: 350 }, // Jul
        { temperatureMin: 26, temperatureMax: 33, rainfall: 400 }, // Aug
        { temperatureMin: 24, temperatureMax: 32, rainfall: 150 }, // Sep
        { temperatureMin: 22, temperatureMax: 30, rainfall: 30 }, // Oct
        { temperatureMin: 18, temperatureMax: 27, rainfall: 20 }, // Nov
        { temperatureMin: 14, temperatureMax: 23, rainfall: 20 }, // Dec
      ],
      south: [
        { temperatureMin: 15, temperatureMax: 24, rainfall: 20 }, // Jan
        { temperatureMin: 16, temperatureMax: 25, rainfall: 25 }, // Feb
        { temperatureMin: 19, temperatureMax: 28, rainfall: 35 }, // Mar
        { temperatureMin: 22, temperatureMax: 30, rainfall: 70 }, // Apr
        { temperatureMin: 25, temperatureMax: 32, rainfall: 180 }, // May
        { temperatureMin: 26, temperatureMax: 33, rainfall: 400 }, // Jun
        { temperatureMin: 27, temperatureMax: 33, rainfall: 450 }, // Jul
        { temperatureMin: 26, temperatureMax: 33, rainfall: 500 }, // Aug
        { temperatureMin: 26, temperatureMax: 32, rainfall: 250 }, // Sep
        { temperatureMin: 24, temperatureMax: 31, rainfall: 50 }, // Oct
        { temperatureMin: 20, temperatureMax: 28, rainfall: 20 }, // Nov
        { temperatureMin: 17, temperatureMax: 25, rainfall: 15 }, // Dec
      ],
      east: [
        { temperatureMin: 14, temperatureMax: 21, rainfall: 80 }, // Jan
        { temperatureMin: 14, temperatureMax: 22, rainfall: 100 }, // Feb
        { temperatureMin: 16, temperatureMax: 24, rainfall: 100 }, // Mar
        { temperatureMin: 19, temperatureMax: 27, rainfall: 110 }, // Apr
        { temperatureMin: 22, temperatureMax: 29, rainfall: 200 }, // May
        { temperatureMin: 24, temperatureMax: 31, rainfall: 200 }, // Jun
        { temperatureMin: 26, temperatureMax: 33, rainfall: 200 }, // Jul
        { temperatureMin: 26, temperatureMax: 33, rainfall: 280 }, // Aug
        { temperatureMin: 24, temperatureMax: 31, rainfall: 350 }, // Sep
        { temperatureMin: 22, temperatureMax: 28, rainfall: 300 }, // Oct
        { temperatureMin: 19, temperatureMax: 25, rainfall: 200 }, // Nov
        { temperatureMin: 15, temperatureMax: 22, rainfall: 100 }, // Dec
      ],
    };

    return regionAverages[region];
  }

  /**
   * Clears the weather cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Creates a default WeatherService instance.
 */
export function createWeatherService(config?: WeatherServiceConfig): WeatherService {
  return new WeatherService(config);
}
