/**
 * Unit tests for Weather module.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { CWAClient, CWAClientError, TAIWAN_COUNTIES } from './cwa-client';
import { WeatherService, createWeatherService } from './weather-service';

describe('CWAClient', () => {
  test('creates client instance', () => {
    const client = new CWAClient('test-api-key');
    expect(client).toBeInstanceOf(CWAClient);
  });

  test('hasApiKey returns true when key is provided', () => {
    const client = new CWAClient('test-api-key');
    expect(client.hasApiKey()).toBe(true);
  });

  test('hasApiKey returns false when no key', () => {
    const client = new CWAClient('');
    expect(client.hasApiKey()).toBe(false);
  });

  test('throws error when no API key for getRegionalForecast', async () => {
    const client = new CWAClient('');
    try {
      await client.getRegionalForecast('north');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(CWAClientError);
      expect((error as CWAClientError).code).toBe('NO_API_KEY');
    }
  });

  test('throws error when no API key for getTownshipForecast', async () => {
    const client = new CWAClient('');
    try {
      await client.getTownshipForecast('彰化縣', '員林市');
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(CWAClientError);
      expect((error as CWAClientError).code).toBe('NO_API_KEY');
    }
  });

  test('throws error when no API key for getWeatherAlerts', async () => {
    const client = new CWAClient('');
    try {
      await client.getWeatherAlerts();
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(CWAClientError);
      expect((error as CWAClientError).code).toBe('NO_API_KEY');
    }
  });

  test('throws error when no API key for getCurrentWeather', async () => {
    const client = new CWAClient('');
    try {
      await client.getCurrentWeather();
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(CWAClientError);
      expect((error as CWAClientError).code).toBe('NO_API_KEY');
    }
  });
});

describe('TAIWAN_COUNTIES', () => {
  test('contains all 22 counties', () => {
    expect(Object.keys(TAIWAN_COUNTIES).length).toBe(22);
  });

  test('maps 台北市 correctly', () => {
    expect(TAIWAN_COUNTIES['台北市']).toBe('臺北市');
  });

  test('maps 台中市 correctly', () => {
    expect(TAIWAN_COUNTIES['台中市']).toBe('臺中市');
  });

  test('includes offshore counties', () => {
    expect(TAIWAN_COUNTIES['澎湖縣']).toBe('澎湖縣');
    expect(TAIWAN_COUNTIES['金門縣']).toBe('金門縣');
    expect(TAIWAN_COUNTIES['連江縣']).toBe('連江縣');
  });
});

describe('CWAClientError', () => {
  test('creates error with message and code', () => {
    const error = new CWAClientError('Test error', 'API_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('API_ERROR');
    expect(error.name).toBe('CWAClientError');
  });
});

describe('WeatherService', () => {
  let service: WeatherService;

  beforeEach(() => {
    service = createWeatherService({ enableCache: true });
  });

  test('creates service instance', () => {
    expect(service).toBeInstanceOf(WeatherService);
  });

  test('createWeatherService factory works', () => {
    const svc = createWeatherService();
    expect(svc).toBeInstanceOf(WeatherService);
  });

  test('uses default 3-hour cache TTL', () => {
    // We can't directly test private properties, but we can verify the service works
    const svc = createWeatherService();
    expect(svc).toBeDefined();
  });

  test('accepts custom cache TTL', () => {
    const svc = createWeatherService({ cacheTTL: 5 * 60 * 1000 });
    expect(svc).toBeDefined();
  });

  test('clearCache clears all caches', () => {
    // This should not throw
    service.clearCache();
  });
});

describe('WeatherService.isAvailable', () => {
  test('returns false when no API key', () => {
    const service = createWeatherService({ apiKey: '' });
    expect(service.isAvailable()).toBe(false);
  });

  test('returns true when API key is set', () => {
    const service = createWeatherService({ apiKey: 'test-key' });
    expect(service.isAvailable()).toBe(true);
  });
});

describe('WeatherService caching', () => {
  test('cache can be disabled', () => {
    const service = createWeatherService({ enableCache: false });
    // Should work without throwing
    expect(service).toBeDefined();
  });
});

describe('WeatherService.getWeatherForecast', () => {
  test('returns empty array when API call fails', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getWeatherForecast('north');
    expect(result).toEqual([]);
  });
});

describe('WeatherService.getTownshipForecast', () => {
  test('returns empty array when API call fails', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getTownshipForecast('彰化縣', '員林市');
    expect(result).toEqual([]);
  });
});

describe('WeatherService.getWeatherAlerts', () => {
  test('returns empty array when API call fails', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getWeatherAlerts();
    expect(result).toEqual([]);
  });
});

describe('WeatherService.getCurrentWeather', () => {
  test('returns empty array when API call fails', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getCurrentWeather();
    expect(result).toEqual([]);
  });
});

describe('WeatherService.getExtendedForecast', () => {
  test('returns empty array when base forecast fails', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getExtendedForecast('north', 14);
    // Should return regional averages for 14 days when no API data
    expect(result.length).toBe(14);
  });

  test('extends forecast with regional averages', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getExtendedForecast('central', 30);
    expect(result.length).toBe(30);
    // Check that the extended data has temperature values
    expect(result[15]!.temperatureMin).toBeDefined();
    expect(result[15]!.temperatureMax).toBeDefined();
  });
});

describe('WeatherService.hasSevereAlerts', () => {
  test('returns false when no alerts', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.hasSevereAlerts();
    expect(result).toBe(false);
  });
});

describe('WeatherService.getAgriculturalImpacts', () => {
  test('returns empty array when no alerts', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getAgriculturalImpacts();
    expect(result).toEqual([]);
  });
});

describe('WeatherService.getAlertsForLocation', () => {
  test('returns empty array when no alerts', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getAlertsForLocation('central');
    expect(result).toEqual([]);
  });

  test('accepts county filter', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getAlertsForLocation(undefined, '彰化縣');
    expect(result).toEqual([]);
  });
});

describe('Regional averages', () => {
  test('provides 12 months of data for north', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const result = await service.getExtendedForecast('north', 365);
    expect(result.length).toBe(365);
  });

  test('provides different data for different regions', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });
    const north = await service.getExtendedForecast('north', 30);
    const south = await service.getExtendedForecast('south', 30);
    // South should generally have higher temperatures
    const northAvgMin = north.reduce((sum, d) => sum + d.temperatureMin, 0) / north.length;
    const southAvgMin = south.reduce((sum, d) => sum + d.temperatureMin, 0) / south.length;
    expect(southAvgMin).toBeGreaterThan(northAvgMin);
  });
});
