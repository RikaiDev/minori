/**
 * Weather Service
 *
 * High-level service for fetching and processing weather data for agricultural use.
 * Provides weather forecasts, alerts, and current conditions for harvest prediction
 * and agricultural planning.
 */

import type { TaiwanRegion } from '@minori/shared';
import {
  CWAClient,
  CWAClientError,
  type CWAWeatherForecast,
  type CWAWeatherAlert,
  type CurrentWeather,
} from './cwa-client';
import type { WeatherData } from '../prediction/harvest-predictor';

/**
 * Configuration options for WeatherService.
 */
export interface WeatherServiceConfig {
  /** CWA API key (optional, will use env var if not provided) */
  apiKey?: string;
  /** Enable caching of weather data */
  enableCache?: boolean;
  /** Cache TTL in milliseconds (default: 3 hours) */
  cacheTTL?: number;
}

/**
 * Cached weather data entry.
 */
interface CacheEntry<T = WeatherData[]> {
  data: T;
  timestamp: number;
}

/**
 * Weather service for fetching and managing weather data.
 */
export class WeatherService {
  private client: CWAClient;
  private cache: Map<string, CacheEntry<WeatherData[]>>;
  private alertCache: Map<string, CacheEntry<CWAWeatherAlert[]>>;
  private currentWeatherCache: Map<string, CacheEntry<CurrentWeather[]>>;
  private cacheTTL: number;
  private enableCache: boolean;

  constructor(config: WeatherServiceConfig = {}) {
    this.client = new CWAClient(config.apiKey);
    this.cache = new Map();
    this.alertCache = new Map();
    this.currentWeatherCache = new Map();
    this.enableCache = config.enableCache ?? true;
    this.cacheTTL = config.cacheTTL ?? 3 * 60 * 60 * 1000; // 3 hours default
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
   * Fetches weather forecast for a specific township.
   *
   * @param county - County name (e.g., '彰化縣', '高雄市')
   * @param township - Township name (e.g., '員林市', '美濃區')
   * @returns Array of weather data for the forecast period
   */
  async getTownshipForecast(county: string, township: string): Promise<WeatherData[]> {
    const cacheKey = `township:${county}:${township}`;

    // Check cache first
    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const forecasts = await this.client.getTownshipForecast(county, township);
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
        console.warn(`Weather service error: ${error.message} (${error.code})`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Fetches active weather alerts from CWA.
   *
   * @returns Array of active weather alerts
   */
  async getWeatherAlerts(): Promise<CWAWeatherAlert[]> {
    const cacheKey = 'alerts';

    // Check cache first (use shorter TTL for alerts: 30 minutes)
    if (this.enableCache) {
      const cached = this.alertCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
        return cached.data;
      }
    }

    try {
      const alerts = await this.client.getWeatherAlerts();

      // Update cache
      if (this.enableCache) {
        this.alertCache.set(cacheKey, {
          data: alerts,
          timestamp: Date.now(),
        });
      }

      return alerts;
    } catch (error) {
      if (error instanceof CWAClientError) {
        console.warn(`Weather alerts error: ${error.message} (${error.code})`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Gets weather alerts filtered by region or county.
   *
   * @param region - Taiwan region to filter by (optional)
   * @param county - Specific county to filter by (optional)
   * @returns Filtered weather alerts
   */
  async getAlertsForLocation(region?: TaiwanRegion, county?: string): Promise<CWAWeatherAlert[]> {
    const alerts = await this.getWeatherAlerts();

    if (!region && !county) {
      return alerts;
    }

    // Map regions to counties for filtering
    const regionCounties: Record<TaiwanRegion, string[]> = {
      north: ['臺北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '宜蘭縣'],
      central: ['臺中市', '苗栗縣', '彰化縣', '南投縣', '雲林縣'],
      south: ['臺南市', '高雄市', '嘉義市', '嘉義縣', '屏東縣'],
      east: ['花蓮縣', '臺東縣'],
    };

    return alerts.filter((alert) => {
      // Filter by specific county
      if (county) {
        return alert.affectedAreas.some((area) => area.includes(county));
      }

      // Filter by region
      if (region) {
        const counties = regionCounties[region];
        return alert.affectedAreas.some((area) => counties.some((c) => area.includes(c)));
      }

      return true;
    });
  }

  /**
   * Fetches current weather observations.
   *
   * @param stationName - Weather station name (optional)
   * @returns Array of current weather observations
   */
  async getCurrentWeather(stationName?: string): Promise<CurrentWeather[]> {
    const cacheKey = stationName ? `current:${stationName}` : 'current:all';

    // Check cache first (use shorter TTL for current weather: 15 minutes)
    if (this.enableCache) {
      const cached = this.currentWeatherCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
        return cached.data;
      }
    }

    try {
      const weather = await this.client.getCurrentWeather(stationName);

      // Update cache
      if (this.enableCache) {
        this.currentWeatherCache.set(cacheKey, {
          data: weather,
          timestamp: Date.now(),
        });
      }

      return weather;
    } catch (error) {
      if (error instanceof CWAClientError) {
        console.warn(`Current weather error: ${error.message} (${error.code})`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Checks if there are any active severe weather alerts.
   *
   * @returns True if there are warning-level alerts
   */
  async hasSevereAlerts(): Promise<boolean> {
    const alerts = await this.getWeatherAlerts();
    return alerts.some((alert) => alert.severity === 'warning');
  }

  /**
   * Gets agricultural impact summary from active alerts.
   *
   * @returns Array of agricultural impact messages
   */
  async getAgriculturalImpacts(): Promise<string[]> {
    const alerts = await this.getWeatherAlerts();
    return alerts
      .filter((alert) => alert.agriculturalImpact)
      .map((alert) => alert.agriculturalImpact!);
  }

  /**
   * Clears the weather cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.alertCache.clear();
    this.currentWeatherCache.clear();
  }
}

/**
 * Creates a default WeatherService instance.
 */
export function createWeatherService(config?: WeatherServiceConfig): WeatherService {
  return new WeatherService(config);
}
