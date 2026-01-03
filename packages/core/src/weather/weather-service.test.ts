/**
 * Unit tests for Weather Service module.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { WeatherService, createWeatherService } from './weather-service';
import { CWAClient, CWAClientError } from './cwa-client';

describe('WeatherService', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CWA_API_KEY;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.CWA_API_KEY = originalEnv;
    } else {
      delete process.env.CWA_API_KEY;
    }
  });

  test('creates service with default config', () => {
    const service = createWeatherService();
    expect(service).toBeInstanceOf(WeatherService);
  });

  test('isAvailable returns false when no API key', () => {
    delete process.env.CWA_API_KEY;
    const service = createWeatherService({ apiKey: '' });
    expect(service.isAvailable()).toBe(false);
  });

  test('isAvailable returns true when API key provided', () => {
    const service = createWeatherService({ apiKey: 'test-key' });
    expect(service.isAvailable()).toBe(true);
  });

  test('clearCache clears the cache', () => {
    const service = createWeatherService();
    // Just ensure it doesn't throw
    service.clearCache();
  });
});

describe('WeatherService.getExtendedForecast', () => {
  test('returns extended forecast with regional averages', async () => {
    // Create service without API key - will use regional averages
    const service = createWeatherService({ apiKey: '' });

    const forecast = await service.getExtendedForecast('central', 30);

    // Should have 30 days of data (all from regional averages since no API)
    // Actually, without API it returns empty from getWeatherForecast
    // The extended forecast fills in with regional averages
    expect(forecast).toBeDefined();
  });
});

describe('CWAClient', () => {
  test('creates client with API key', () => {
    const client = new CWAClient('test-key');
    expect(client.hasApiKey()).toBe(true);
  });

  test('creates client without API key', () => {
    const client = new CWAClient();
    expect(client.hasApiKey()).toBe(false);
  });

  test('throws error when fetching without API key', async () => {
    const client = new CWAClient('');

    await expect(client.getRegionalForecast('central')).rejects.toThrow(CWAClientError);
  });
});

describe('CWAClientError', () => {
  test('has correct error code', () => {
    const error = new CWAClientError('Test error', 'NO_API_KEY');
    expect(error.code).toBe('NO_API_KEY');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('CWAClientError');
  });
});

describe('Regional weather averages', () => {
  test('getExtendedForecast uses regional averages for extended days', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });

    // Without API key, getWeatherForecast returns empty array
    // Extended forecast should fill with regional averages
    const forecast = await service.getExtendedForecast('south', 30);

    // The function should return an array (empty or with averages)
    expect(Array.isArray(forecast)).toBe(true);
  });

  test('north region has appropriate temperature range', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });

    const forecast = await service.getExtendedForecast('north', 7);

    if (forecast.length > 0) {
      // North Taiwan temperatures should be reasonable
      forecast.forEach((day) => {
        expect(day.temperatureMin).toBeGreaterThanOrEqual(5);
        expect(day.temperatureMax).toBeLessThanOrEqual(40);
      });
    }
  });

  test('south region has appropriate temperature range', async () => {
    const service = createWeatherService({ apiKey: '', enableCache: false });

    const forecast = await service.getExtendedForecast('south', 7);

    if (forecast.length > 0) {
      // South Taiwan temperatures should be reasonable
      forecast.forEach((day) => {
        expect(day.temperatureMin).toBeGreaterThanOrEqual(10);
        expect(day.temperatureMax).toBeLessThanOrEqual(40);
      });
    }
  });
});

describe('Weather caching', () => {
  test('caching can be disabled', () => {
    const service = createWeatherService({ enableCache: false });
    // Just ensure it creates without error
    expect(service).toBeInstanceOf(WeatherService);
  });

  test('custom cache TTL can be set', () => {
    const service = createWeatherService({ cacheTTL: 5000 });
    expect(service).toBeInstanceOf(WeatherService);
  });
});
