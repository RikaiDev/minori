/**
 * CWA (Central Weather Administration) API Client
 *
 * Fetches weather data from Taiwan's Central Weather Administration Open Data API.
 * API Documentation: https://opendata.cwa.gov.tw/
 *
 * Main endpoints used:
 * - F-D0047-091: 7-day weather forecast for all counties
 * - F-D0047-xxx: Township-level forecasts by county
 * - W-C0033-002: Weather alerts and warnings
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
 * Weather alert/warning data.
 */
export interface CWAWeatherAlert {
  /** Alert ID */
  id: string;
  /** Alert type (e.g., typhoon, heavy rain, cold surge) */
  type: WeatherAlertType;
  /** Alert severity level */
  severity: 'advisory' | 'watch' | 'warning';
  /** Alert title */
  title: string;
  /** Detailed description */
  description: string;
  /** Affected areas */
  affectedAreas: string[];
  /** Start time of the alert */
  startTime: Date;
  /** End time of the alert (if known) */
  endTime?: Date;
  /** When the alert was issued */
  issuedAt: Date;
  /** Agricultural impact notes */
  agriculturalImpact?: string;
}

/**
 * Types of weather alerts.
 */
export type WeatherAlertType =
  | 'typhoon' // 颱風
  | 'heavy_rain' // 豪雨
  | 'torrential_rain' // 大豪雨
  | 'thunderstorm' // 雷雨
  | 'cold_surge' // 寒流
  | 'frost' // 霜害
  | 'high_temperature' // 高溫
  | 'strong_wind' // 強風
  | 'fog' // 濃霧
  | 'other';

/**
 * Agricultural weather advisory.
 */
export interface AgriculturalAdvisory {
  /** Advisory ID */
  id: string;
  /** Advisory title */
  title: string;
  /** Detailed content */
  content: string;
  /** Affected crops (if specified) */
  affectedCrops?: string[];
  /** Recommended actions */
  recommendations: string[];
  /** Issue date */
  issuedAt: Date;
  /** Valid until */
  validUntil: Date;
  /** Affected regions */
  regions: TaiwanRegion[];
}

/**
 * Current weather observation.
 */
export interface CurrentWeather {
  /** Station name */
  stationName: string;
  /** Location (county/township) */
  location: string;
  /** Observation time */
  observedAt: Date;
  /** Current temperature (°C) */
  temperature: number;
  /** Relative humidity (%) */
  humidity: number;
  /** Wind speed (m/s) */
  windSpeed: number;
  /** Wind direction */
  windDirection: string;
  /** Rainfall in the last hour (mm) */
  rainfall: number;
  /** Weather description */
  weather: string;
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
 * Taiwan counties with their codes.
 */
export const TAIWAN_COUNTIES: Record<string, string> = {
  台北市: '臺北市',
  新北市: '新北市',
  桃園市: '桃園市',
  台中市: '臺中市',
  台南市: '臺南市',
  高雄市: '高雄市',
  基隆市: '基隆市',
  新竹市: '新竹市',
  嘉義市: '嘉義市',
  新竹縣: '新竹縣',
  苗栗縣: '苗栗縣',
  彰化縣: '彰化縣',
  南投縣: '南投縣',
  雲林縣: '雲林縣',
  嘉義縣: '嘉義縣',
  屏東縣: '屏東縣',
  宜蘭縣: '宜蘭縣',
  花蓮縣: '花蓮縣',
  台東縣: '臺東縣',
  澎湖縣: '澎湖縣',
  金門縣: '金門縣',
  連江縣: '連江縣',
};

/**
 * Dataset IDs for different forecast types.
 */
const DATASET_IDS = {
  // 7-day forecast for all counties (general forecast)
  sevenDayForecast: 'F-D0047-091',
  // 7-day forecast for specific counties (includes township data)
  countyForecast: {
    臺北市: 'F-D0047-061',
    新北市: 'F-D0047-069',
    桃園市: 'F-D0047-007',
    臺中市: 'F-D0047-075',
    臺南市: 'F-D0047-079',
    高雄市: 'F-D0047-065',
    基隆市: 'F-D0047-051',
    新竹市: 'F-D0047-053',
    嘉義市: 'F-D0047-059',
    新竹縣: 'F-D0047-009',
    苗栗縣: 'F-D0047-013',
    彰化縣: 'F-D0047-019',
    南投縣: 'F-D0047-021',
    雲林縣: 'F-D0047-025',
    嘉義縣: 'F-D0047-029',
    屏東縣: 'F-D0047-033',
    宜蘭縣: 'F-D0047-003',
    花蓮縣: 'F-D0047-041',
    臺東縣: 'F-D0047-039',
    澎湖縣: 'F-D0047-045',
    金門縣: 'F-D0047-085',
    連江縣: 'F-D0047-083',
  } as Record<string, string>,
  // Weather alerts
  weatherAlerts: 'W-C0033-002',
  // Current observations
  currentObservations: 'O-A0003-001',
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

  /**
   * Fetches weather forecast for a specific township.
   *
   * @param county - County name (e.g., '彰化縣', '高雄市')
   * @param township - Township name (e.g., '員林市', '美濃區')
   * @returns Array of weather forecasts for the township
   */
  async getTownshipForecast(county: string, township: string): Promise<CWAWeatherForecast[]> {
    if (!this.hasApiKey()) {
      throw new CWAClientError('CWA API key not configured', 'NO_API_KEY');
    }

    // Normalize county name
    const normalizedCounty = TAIWAN_COUNTIES[county] || county;
    const datasetId = DATASET_IDS.countyForecast[normalizedCounty];

    if (!datasetId) {
      throw new CWAClientError(`Unknown county: ${county}`, 'INVALID_RESPONSE');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${datasetId}?Authorization=${this.apiKey}&locationName=${encodeURIComponent(township)}&elementName=MinT,MaxT,PoP12h,Wx,RH`
      );

      if (!response.ok) {
        throw new CWAClientError(`CWA API request failed: ${response.status}`, 'API_ERROR');
      }

      const data = (await response.json()) as CWAForecastResponse;

      if (data.success !== 'true') {
        throw new CWAClientError('Invalid response from CWA API', 'INVALID_RESPONSE');
      }

      // If township not found, fallback to first location
      if (!data.records?.Locations?.[0]?.Location?.[0]) {
        return [];
      }

      return this.parseForecastResponse(data);
    } catch (error) {
      if (error instanceof CWAClientError) {
        throw error;
      }
      throw new CWAClientError(
        `Failed to fetch township forecast: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * Fetches active weather alerts and warnings.
   *
   * @returns Array of active weather alerts
   */
  async getWeatherAlerts(): Promise<CWAWeatherAlert[]> {
    if (!this.hasApiKey()) {
      throw new CWAClientError('CWA API key not configured', 'NO_API_KEY');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${DATASET_IDS.weatherAlerts}?Authorization=${this.apiKey}`
      );

      if (!response.ok) {
        throw new CWAClientError(`CWA API request failed: ${response.status}`, 'API_ERROR');
      }

      const data = (await response.json()) as { success: string };

      if (data.success !== 'true') {
        throw new CWAClientError('Invalid response from CWA API', 'INVALID_RESPONSE');
      }

      return this.parseWeatherAlerts(data);
    } catch (error) {
      if (error instanceof CWAClientError) {
        throw error;
      }
      throw new CWAClientError(
        `Failed to fetch weather alerts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * Parses weather alert response from CWA API.
   */
  private parseWeatherAlerts(data: unknown): CWAWeatherAlert[] {
    const alerts: CWAWeatherAlert[] = [];
    const records = (data as { records?: { record?: unknown[] } }).records;

    if (!records?.record || !Array.isArray(records.record)) {
      return alerts;
    }

    for (const record of records.record) {
      const r = record as {
        datasetDescription?: string;
        hazardConditions?: {
          hazards?: {
            info?: {
              phenomena?: string;
              significance?: string;
            };
            hazardInfo?: {
              affectedAreas?: { locationName?: string }[];
              onset?: string;
              expires?: string;
            };
          };
        };
        contents?: {
          content?: {
            contentText?: string;
          };
        };
        sent?: string;
      };

      const phenomena = r.hazardConditions?.hazards?.info?.phenomena || '';
      const significance = r.hazardConditions?.hazards?.info?.significance || '';
      const affectedAreas = r.hazardConditions?.hazards?.hazardInfo?.affectedAreas || [];

      alerts.push({
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: this.mapPhenomenaToAlertType(phenomena),
        severity: this.mapSignificanceToSeverity(significance),
        title: r.datasetDescription || phenomena,
        description: r.contents?.content?.contentText || '',
        affectedAreas: affectedAreas.map((a) => a.locationName || '').filter(Boolean),
        startTime: r.hazardConditions?.hazards?.hazardInfo?.onset
          ? new Date(r.hazardConditions.hazards.hazardInfo.onset)
          : new Date(),
        endTime: r.hazardConditions?.hazards?.hazardInfo?.expires
          ? new Date(r.hazardConditions.hazards.hazardInfo.expires)
          : undefined,
        issuedAt: r.sent ? new Date(r.sent) : new Date(),
        agriculturalImpact: this.getAgriculturalImpact(phenomena),
      });
    }

    return alerts;
  }

  /**
   * Maps CWA phenomena to alert type.
   */
  private mapPhenomenaToAlertType(phenomena: string): WeatherAlertType {
    const lower = phenomena.toLowerCase();
    if (lower.includes('颱風') || lower.includes('typhoon')) return 'typhoon';
    if (lower.includes('大豪雨') || lower.includes('torrential')) return 'torrential_rain';
    if (lower.includes('豪雨') || lower.includes('heavy rain')) return 'heavy_rain';
    if (lower.includes('雷') || lower.includes('thunder')) return 'thunderstorm';
    if (lower.includes('寒流') || lower.includes('cold')) return 'cold_surge';
    if (lower.includes('霜') || lower.includes('frost')) return 'frost';
    if (lower.includes('高溫') || lower.includes('heat')) return 'high_temperature';
    if (lower.includes('強風') || lower.includes('wind')) return 'strong_wind';
    if (lower.includes('霧') || lower.includes('fog')) return 'fog';
    return 'other';
  }

  /**
   * Maps CWA significance to severity level.
   */
  private mapSignificanceToSeverity(significance: string): 'advisory' | 'watch' | 'warning' {
    const lower = significance.toLowerCase();
    if (lower.includes('警報') || lower.includes('warning')) return 'warning';
    if (lower.includes('特報') || lower.includes('watch')) return 'watch';
    return 'advisory';
  }

  /**
   * Gets agricultural impact description for a weather phenomena.
   */
  private getAgriculturalImpact(phenomena: string): string {
    const impacts: Record<string, string> = {
      颱風: '可能造成作物倒伏、落果，請加強田間排水及支架固定',
      豪雨: '注意田間積水，避免根部腐爛，採收作物應提前收穫',
      寒流: '低溫可能造成寒害，請加強保溫措施，注意葉菜類凍傷',
      霜: '霜害可能損害嫩葉及花果，請做好覆蓋保護措施',
      高溫: '高溫影響授粉及果實發育，請加強灌溉及遮陰',
      強風: '強風可能造成落花落果，請加強支架及防風網',
    };

    for (const [key, impact] of Object.entries(impacts)) {
      if (phenomena.includes(key)) {
        return impact;
      }
    }

    return '請注意天氣變化，適時調整田間管理';
  }

  /**
   * Fetches current weather observations for a location.
   *
   * @param stationName - Weather station name (optional, returns all if not specified)
   * @returns Array of current weather observations
   */
  async getCurrentWeather(stationName?: string): Promise<CurrentWeather[]> {
    if (!this.hasApiKey()) {
      throw new CWAClientError('CWA API key not configured', 'NO_API_KEY');
    }

    try {
      let url = `${this.baseUrl}/${DATASET_IDS.currentObservations}?Authorization=${this.apiKey}`;
      if (stationName) {
        url += `&StationName=${encodeURIComponent(stationName)}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new CWAClientError(`CWA API request failed: ${response.status}`, 'API_ERROR');
      }

      const data = (await response.json()) as { success: string };

      if (data.success !== 'true') {
        throw new CWAClientError('Invalid response from CWA API', 'INVALID_RESPONSE');
      }

      return this.parseCurrentWeather(data);
    } catch (error) {
      if (error instanceof CWAClientError) {
        throw error;
      }
      throw new CWAClientError(
        `Failed to fetch current weather: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * Parses current weather observation response.
   */
  private parseCurrentWeather(data: unknown): CurrentWeather[] {
    const observations: CurrentWeather[] = [];
    const records = (data as { records?: { Station?: unknown[] } }).records;

    if (!records?.Station || !Array.isArray(records.Station)) {
      return observations;
    }

    for (const station of records.Station) {
      const s = station as {
        StationName?: string;
        GeoInfo?: { CountyName?: string; TownName?: string };
        ObsTime?: { DateTime?: string };
        WeatherElement?: {
          Weather?: string;
          AirTemperature?: number;
          RelativeHumidity?: number;
          WindSpeed?: number;
          WindDirection?: string;
          Now?: { Precipitation?: number };
        };
      };

      const weather = s.WeatherElement;
      if (!weather) continue;

      observations.push({
        stationName: s.StationName || '',
        location: `${s.GeoInfo?.CountyName || ''} ${s.GeoInfo?.TownName || ''}`.trim(),
        observedAt: s.ObsTime?.DateTime ? new Date(s.ObsTime.DateTime) : new Date(),
        temperature: weather.AirTemperature ?? 0,
        humidity: weather.RelativeHumidity ?? 0,
        windSpeed: weather.WindSpeed ?? 0,
        windDirection: weather.WindDirection || '',
        rainfall: weather.Now?.Precipitation ?? 0,
        weather: weather.Weather || '',
      });
    }

    return observations;
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
