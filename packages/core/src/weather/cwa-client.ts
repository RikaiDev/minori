/**
 * CWA (Central Weather Administration) API Client
 *
 * Fetches weather data from Taiwan's Central Weather Administration Open Data API.
 * API Documentation: https://opendata.cwa.gov.tw/
 *
 * Main endpoints used:
 * - F-D0047-091: 7-day weather forecast for all counties
 * - O-A0003-001: Current weather observations
 */

import type { TaiwanRegion } from '@minori/shared';

const CWA_API_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore';

/**
 * CWA API response structure for weather forecasts.
 */
export interface CWAForecastResponse {
  success: string;
  result?: {
    resource_id: string;
    fields: Array<{ id: string; type: string }>;
  };
  records?: {
    Locations?: Array<{
      LocationsName: string;
      Location: Array<{
        LocationName: string;
        Geocode: string;
        Lat: string;
        Lon: string;
        WeatherElement: Array<{
          ElementName: string;
          Description: string;
          Time: Array<{
            StartTime: string;
            EndTime: string;
            ElementValue: Array<{
              Value: string;
              Measures: string;
            }>;
          }>;
        }>;
      }>;
    }>;
  };
}

/**
 * Weather forecast data for a specific time period.
 */
export interface CWAWeatherForecast {
  date: Date;
  temperatureMin: number;
  temperatureMax: number;
  rainfall: number;
  weatherDescription: string;
  humidity: number;
}

/**
 * Maps Taiwan regions to representative counties for weather data.
 * Each region uses a major agricultural area as representative.
 */
const REGION_TO_COUNTY: Record<TaiwanRegion, string> = {
  north: '桃園市', // Taoyuan - major agricultural area in north
  central: '彰化縣', // Changhua - major agricultural county in central
  south: '高雄市', // Kaohsiung - major agricultural area in south
  east: '花蓮縣', // Hualien - major agricultural county in east
};

/**
 * Dataset IDs for different forecast types.
 */
const DATASET_IDS = {
  // 7-day forecast for all counties (general forecast)
  sevenDayForecast: 'F-D0047-091',
  // 7-day forecast for specific counties
  countyForecast: {
    桃園市: 'F-D0047-007',
    彰化縣: 'F-D0047-019',
    高雄市: 'F-D0047-065',
    花蓮縣: 'F-D0047-041',
  } as Record<string, string>,
};

/**
 * CWA API Client for fetching weather data.
 */
export class CWAClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CWA_API_KEY || '';
    this.baseUrl = CWA_API_BASE;
  }

  /**
   * Checks if the client has a valid API key configured.
   */
  hasApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Fetches 7-day weather forecast for a specific Taiwan region.
   *
   * @param region - Taiwan region (north, central, south, east)
   * @returns Array of weather forecasts for the next 7 days
   */
  async getRegionalForecast(region: TaiwanRegion): Promise<CWAWeatherForecast[]> {
    if (!this.hasApiKey()) {
      throw new CWAClientError('CWA API key not configured', 'NO_API_KEY');
    }

    const county = REGION_TO_COUNTY[region];
    const datasetId = DATASET_IDS.countyForecast[county] || DATASET_IDS.sevenDayForecast;

    try {
      const response = await fetch(
        `${this.baseUrl}/${datasetId}?Authorization=${this.apiKey}&locationName=${encodeURIComponent(county)}&elementName=MinT,MaxT,PoP12h,Wx,RH`
      );

      if (!response.ok) {
        throw new CWAClientError(`CWA API request failed: ${response.status}`, 'API_ERROR');
      }

      const data = (await response.json()) as CWAForecastResponse;

      if (data.success !== 'true' || !data.records?.Locations?.[0]?.Location?.[0]) {
        throw new CWAClientError('Invalid response from CWA API', 'INVALID_RESPONSE');
      }

      return this.parseForecastResponse(data);
    } catch (error) {
      if (error instanceof CWAClientError) {
        throw error;
      }
      throw new CWAClientError(
        `Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * Parses CWA API response into structured weather forecast data.
   */
  private parseForecastResponse(data: CWAForecastResponse): CWAWeatherForecast[] {
    const location = data.records?.Locations?.[0]?.Location?.[0];
    if (!location) return [];

    const elements = location.WeatherElement;
    const minTempElement = elements.find((e) => e.ElementName === 'MinT');
    const maxTempElement = elements.find((e) => e.ElementName === 'MaxT');
    const popElement = elements.find((e) => e.ElementName === 'PoP12h');
    const wxElement = elements.find((e) => e.ElementName === 'Wx');
    const rhElement = elements.find((e) => e.ElementName === 'RH');

    if (!minTempElement || !maxTempElement) {
      return [];
    }

    // Group forecast data by date
    const forecastsByDate = new Map<string, CWAWeatherForecast>();

    // Process temperature data (available for each 12-hour period)
    minTempElement.Time.forEach((timeSlot, index) => {
      const date = new Date(timeSlot.StartTime);
      const dateKey = date.toISOString().split('T')[0]!;

      const minTemp = parseFloat(timeSlot.ElementValue[0]?.Value || '0');
      const maxTemp = parseFloat(maxTempElement.Time[index]?.ElementValue[0]?.Value || '0');

      // Get probability of precipitation (0-100%)
      const popValue = popElement?.Time[index]?.ElementValue[0]?.Value;
      const pop = popValue ? parseFloat(popValue) : 0;

      // Estimate rainfall from PoP (rough estimation: PoP% * max expected mm)
      // Taiwan avg rainfall is about 10mm per rainy day, so PoP 100% ≈ 10mm
      const estimatedRainfall = (pop / 100) * 10;

      // Get weather description
      const wxValue = wxElement?.Time[index]?.ElementValue[0]?.Value || '';

      // Get humidity
      const rhValue = rhElement?.Time[index]?.ElementValue[0]?.Value;
      const humidity = rhValue ? parseFloat(rhValue) : 75; // Default 75% for Taiwan

      const existing = forecastsByDate.get(dateKey);
      if (existing) {
        // Update with min/max across the day
        existing.temperatureMin = Math.min(existing.temperatureMin, minTemp);
        existing.temperatureMax = Math.max(existing.temperatureMax, maxTemp);
        existing.rainfall += estimatedRainfall;
        existing.humidity = Math.max(existing.humidity, humidity);
      } else {
        forecastsByDate.set(dateKey, {
          date,
          temperatureMin: minTemp,
          temperatureMax: maxTemp,
          rainfall: estimatedRainfall,
          weatherDescription: wxValue,
          humidity,
        });
      }
    });

    return Array.from(forecastsByDate.values()).slice(0, 7); // Limit to 7 days
  }
}

/**
 * Custom error class for CWA API errors.
 */
export class CWAClientError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_API_KEY' | 'API_ERROR' | 'INVALID_RESPONSE' | 'FETCH_ERROR'
  ) {
    super(message);
    this.name = 'CWAClientError';
  }
}
