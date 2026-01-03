/**
 * MOA (Ministry of Agriculture) Price API Client
 *
 * Fetches agricultural product trading data from Taiwan's Ministry of Agriculture
 * Open Data Platform. Data includes daily prices and trading volumes for vegetables,
 * fruits, and flowers across major markets.
 *
 * API Documentation: https://data.moa.gov.tw/open_detail.aspx?id=037
 */

const MOA_API_BASE = 'https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx';

/**
 * Raw API response item from MOA.
 */
export interface MOARawPriceData {
  交易日期: string; // Transaction date in ROC format (e.g., "113.01.02")
  種類代碼: string; // Category code
  作物代號: string; // Crop code
  作物名稱: string; // Crop name
  市場代號: string; // Market code
  市場名稱: string; // Market name
  上價: number; // High price (TWD/kg)
  中價: number; // Middle price (TWD/kg)
  下價: number; // Low price (TWD/kg)
  平均價: number; // Average price (TWD/kg)
  交易量: number; // Trading volume (kg)
}

/**
 * Parsed price data with normalized fields.
 */
export interface PriceData {
  date: Date;
  cropCode: string;
  cropName: string;
  marketCode: string;
  marketName: string;
  priceHigh: number;
  priceMid: number;
  priceLow: number;
  priceAvg: number;
  volume: number;
}

/**
 * Query options for fetching price data.
 */
export interface PriceQueryOptions {
  /** Start date for the query */
  startDate?: Date;
  /** End date for the query */
  endDate?: Date;
  /** Filter by market code */
  marketCode?: string;
  /** Filter by crop name (Chinese) */
  cropName?: string;
  /** Maximum number of records to fetch */
  limit?: number;
  /** Number of records to skip (for pagination) */
  offset?: number;
}

/**
 * Major Taiwan agricultural markets.
 */
export const TAIWAN_MARKETS: Record<string, string> = {
  '104': '台北一',
  '105': '台北二',
  '109': '板橋區',
  '106': '三重區',
  '207': '宜蘭市',
  '400': '台中市',
  '410': '豐原區',
  '420': '永靖鄉',
  '411': '彰化市',
  '514': '南投市',
  '512': '西螺鎮',
  '648': '鳳山區',
  '649': '高雄市',
  '615': '屏東站',
  '950': '花蓮市',
  '880': '台東市',
};

/**
 * Converts a Gregorian date to ROC (Republic of China) calendar format.
 * ROC year = Gregorian year - 1911
 *
 * @param date - Date to convert
 * @returns ROC date string (e.g., "113.01.02")
 */
export function toROCDate(date: Date): string {
  const year = date.getFullYear() - 1911;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

/**
 * Converts an ROC date string to a Gregorian Date object.
 *
 * @param rocDate - ROC date string (e.g., "113.01.02")
 * @returns JavaScript Date object
 */
export function fromROCDate(rocDate: string): Date {
  const parts = rocDate.split('.');
  if (parts.length !== 3) {
    throw new MOAClientError(`Invalid ROC date format: ${rocDate}`, 'INVALID_DATE');
  }
  const year = parseInt(parts[0]!, 10) + 1911;
  const month = parseInt(parts[1]!, 10) - 1;
  const day = parseInt(parts[2]!, 10);
  return new Date(year, month, day);
}

/**
 * MOA API Client for fetching agricultural price data.
 */
export class MOAClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = MOA_API_BASE;
  }

  /**
   * Fetches price data from the MOA API.
   *
   * @param options - Query options
   * @returns Array of price data records
   */
  async getPrices(options: PriceQueryOptions = {}): Promise<PriceData[]> {
    const params = new URLSearchParams();

    // Set date range
    if (options.startDate) {
      params.set('StartDate', toROCDate(options.startDate));
    }
    if (options.endDate) {
      params.set('EndDate', toROCDate(options.endDate));
    }

    // Set pagination
    params.set('$top', String(options.limit || 1000));
    if (options.offset) {
      params.set('$skip', String(options.offset));
    }

    try {
      const url = `${this.baseUrl}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new MOAClientError(`API request failed: ${response.status}`, 'API_ERROR');
      }

      const rawData = (await response.json()) as MOARawPriceData[];

      if (!Array.isArray(rawData)) {
        throw new MOAClientError('Invalid response format from MOA API', 'INVALID_RESPONSE');
      }

      // Parse and filter data
      let priceData = this.parseRawData(rawData);

      // Apply filters
      if (options.marketCode) {
        priceData = priceData.filter((p) => p.marketCode === options.marketCode);
      }
      if (options.cropName) {
        priceData = priceData.filter((p) => p.cropName.includes(options.cropName!));
      }

      return priceData;
    } catch (error) {
      if (error instanceof MOAClientError) {
        throw error;
      }
      throw new MOAClientError(
        `Failed to fetch price data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * Fetches price data for a specific crop.
   *
   * @param cropName - Crop name in Chinese
   * @param days - Number of days of historical data (default: 30)
   * @returns Array of price data for the crop
   */
  async getCropPrices(cropName: string, days = 30): Promise<PriceData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getPrices({
      startDate,
      endDate,
      cropName,
      limit: 5000, // Get enough data for trend analysis
    });
  }

  /**
   * Fetches the latest prices for all crops.
   *
   * @returns Array of the most recent price data
   */
  async getLatestPrices(): Promise<PriceData[]> {
    // Get last 4 days (API default, accounts for weekends/holidays)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 4);

    return this.getPrices({
      startDate,
      endDate,
      limit: 5000,
    });
  }

  /**
   * Parses raw API response into structured price data.
   */
  private parseRawData(rawData: MOARawPriceData[]): PriceData[] {
    return rawData
      .filter((item) => item.作物名稱 && item.交易日期)
      .map((item) => ({
        date: fromROCDate(item.交易日期),
        cropCode: item.作物代號,
        cropName: item.作物名稱,
        marketCode: item.市場代號,
        marketName: item.市場名稱,
        priceHigh: item.上價 || 0,
        priceMid: item.中價 || 0,
        priceLow: item.下價 || 0,
        priceAvg: item.平均價 || 0,
        volume: item.交易量 || 0,
      }));
  }
}

/**
 * Custom error class for MOA API errors.
 */
export class MOAClientError extends Error {
  constructor(
    message: string,
    public readonly code: 'API_ERROR' | 'INVALID_RESPONSE' | 'FETCH_ERROR' | 'INVALID_DATE'
  ) {
    super(message);
    this.name = 'MOAClientError';
  }
}
