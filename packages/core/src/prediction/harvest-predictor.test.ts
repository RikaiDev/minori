/**
 * Unit tests for Harvest Predictor module.
 */

import { describe, expect, test } from 'bun:test';
import { predictHarvest, predictHarvestWithWeather, type WeatherData } from './harvest-predictor';
import type { CropInfo } from '@minori/shared';

// Mock crop data for testing
const mockBokChoy: CropInfo = {
  id: 'bok-choy',
  name: '小白菜',
  aliases: ['青江菜'],
  category: 'leafy',
  growth: {
    daysMin: 20,
    daysMax: 35,
    daysOptimal: 28,
    temperatureMin: 10,
    temperatureMax: 28,
    temperatureOptimal: 20,
  },
  seasons: ['spring', 'autumn', 'winter'],
  yield: { perArea: 300, variance: 0.2 },
  commonPests: ['蚜蟲'],
};

const mockTomato: CropInfo = {
  id: 'tomato',
  name: '番茄',
  aliases: ['西紅柿'],
  category: 'fruit',
  growth: {
    daysMin: 60,
    daysMax: 90,
    daysOptimal: 75,
    temperatureMin: 15,
    temperatureMax: 30,
    temperatureOptimal: 24,
  },
  seasons: ['autumn', 'winter', 'spring'],
  yield: { perArea: 3000, variance: 0.3 },
  commonPests: ['番茄夜蛾'],
  regions: [{ region: 'south', notes: '高雄美濃小番茄知名', yieldMultiplier: 1.2 }],
};

describe('predictHarvest', () => {
  const plantingDate = new Date('2025-01-15');

  test('returns prediction with correct crop ID', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    expect(prediction.cropId).toBe('bok-choy');
  });

  test('returns prediction with correct planting date', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    expect(prediction.plantingDate.getTime()).toBe(plantingDate.getTime());
  });

  test('calculates earliest harvest date using daysMin', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    const expectedDate = new Date('2025-02-04'); // 15 + 20 days
    expect(prediction.predictions.earliest.getTime()).toBe(expectedDate.getTime());
  });

  test('calculates likely harvest date using daysOptimal', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    const expectedDate = new Date('2025-02-12'); // 15 + 28 days
    expect(prediction.predictions.likely.getTime()).toBe(expectedDate.getTime());
  });

  test('calculates latest harvest date using daysMax', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    const expectedDate = new Date('2025-02-19'); // 15 + 35 days
    expect(prediction.predictions.latest.getTime()).toBe(expectedDate.getTime());
  });

  test('has reasonable confidence without weather data', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    // Confidence is affected by crop variability
    // Mock bok choy has high variance (daysMax - daysMin = 15, optimal = 28)
    // so confidence is reduced
    expect(prediction.confidence).toBeGreaterThanOrEqual(0.3);
    expect(prediction.confidence).toBeLessThan(0.8);
  });

  test('includes base growth days in factors', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    expect(prediction.factors.baseGrowthDays).toBe(28);
  });
});

describe('predictHarvest with weather data', () => {
  const plantingDate = new Date('2025-01-15');

  test('increases confidence with weather data', () => {
    const weather: WeatherData[] = Array(7)
      .fill(null)
      .map((_, i) => ({
        date: new Date(plantingDate.getTime() + i * 24 * 60 * 60 * 1000),
        temperatureMin: 18,
        temperatureMax: 25,
        rainfall: 5,
      }));

    const predictionNoWeather = predictHarvest(mockBokChoy, plantingDate);
    const predictionWithWeather = predictHarvest(mockBokChoy, plantingDate, { weather });

    expect(predictionWithWeather.confidence).toBeGreaterThan(predictionNoWeather.confidence);
  });

  test('adjusts for cold temperatures', () => {
    const coldWeather: WeatherData[] = Array(7)
      .fill(null)
      .map((_, i) => ({
        date: new Date(plantingDate.getTime() + i * 24 * 60 * 60 * 1000),
        temperatureMin: 5,
        temperatureMax: 10,
        rainfall: 3,
      }));

    const normalPrediction = predictHarvest(mockBokChoy, plantingDate);
    const coldPrediction = predictHarvest(mockBokChoy, plantingDate, { weather: coldWeather });

    // Cold weather should delay harvest
    expect(coldPrediction.predictions.likely.getTime()).toBeGreaterThan(
      normalPrediction.predictions.likely.getTime()
    );
  });

  test('adjusts for hot temperatures', () => {
    const hotWeather: WeatherData[] = Array(7)
      .fill(null)
      .map((_, i) => ({
        date: new Date(plantingDate.getTime() + i * 24 * 60 * 60 * 1000),
        temperatureMin: 32,
        temperatureMax: 38,
        rainfall: 2,
      }));

    const normalPrediction = predictHarvest(mockBokChoy, plantingDate);
    const hotPrediction = predictHarvest(mockBokChoy, plantingDate, { weather: hotWeather });

    // Hot weather should delay harvest
    expect(hotPrediction.predictions.likely.getTime()).toBeGreaterThan(
      normalPrediction.predictions.likely.getTime()
    );
  });

  test('adjusts for excessive rainfall', () => {
    const rainyWeather: WeatherData[] = Array(7)
      .fill(null)
      .map((_, i) => ({
        date: new Date(plantingDate.getTime() + i * 24 * 60 * 60 * 1000),
        temperatureMin: 18,
        temperatureMax: 25,
        rainfall: 50, // Heavy rain
      }));

    const normalPrediction = predictHarvest(mockBokChoy, plantingDate);
    const rainyPrediction = predictHarvest(mockBokChoy, plantingDate, { weather: rainyWeather });

    // Excessive rain should delay harvest
    expect(rainyPrediction.predictions.likely.getTime()).toBeGreaterThan(
      normalPrediction.predictions.likely.getTime()
    );
  });

  test('optimal weather has minimal adjustment', () => {
    const optimalWeather: WeatherData[] = Array(7)
      .fill(null)
      .map((_, i) => ({
        date: new Date(plantingDate.getTime() + i * 24 * 60 * 60 * 1000),
        temperatureMin: 18,
        temperatureMax: 22,
        rainfall: 5,
      }));

    const prediction = predictHarvest(mockBokChoy, plantingDate, { weather: optimalWeather });

    // Temperature adjustment should be close to 1
    expect(prediction.factors.temperatureAdjustment).toBeLessThan(1.1);
    expect(prediction.factors.rainfallAdjustment).toBe(1);
  });
});

describe('predictHarvest with regional adjustments', () => {
  const plantingDate = new Date('2025-01-15');

  test('uses region parameter for prediction', () => {
    const prediction = predictHarvest(mockTomato, plantingDate, { region: 'south' });
    expect(prediction.cropId).toBe('tomato');
  });

  test('increases confidence when regional data is available', () => {
    const predictionNoRegion = predictHarvest(mockTomato, plantingDate);
    const predictionWithRegion = predictHarvest(mockTomato, plantingDate, { region: 'south' });

    // With regional data, confidence should be higher
    expect(predictionWithRegion.confidence).toBeGreaterThanOrEqual(predictionNoRegion.confidence);
  });

  test('can disable regional adjustments', () => {
    const prediction = predictHarvest(mockTomato, plantingDate, {
      region: 'south',
      useRegionalAdjustments: false,
    });

    // Should still work without errors
    expect(prediction.cropId).toBe('tomato');
  });
});

describe('predictHarvestWithWeather', () => {
  const plantingDate = new Date('2025-01-15');

  test('works without weather service', async () => {
    const prediction = await predictHarvestWithWeather(mockBokChoy, plantingDate, 'central');

    expect(prediction.cropId).toBe('bok-choy');
    expect(prediction.predictions.likely).toBeInstanceOf(Date);
  });

  test('uses weather service when provided', async () => {
    const mockWeatherService = {
      getExtendedForecast: async () => [
        {
          date: new Date(),
          temperatureMin: 18,
          temperatureMax: 25,
          rainfall: 5,
        },
      ],
    };

    const prediction = await predictHarvestWithWeather(
      mockBokChoy,
      plantingDate,
      'central',
      mockWeatherService
    );

    expect(prediction.cropId).toBe('bok-choy');
    expect(prediction.confidence).toBeGreaterThan(0.5);
  });

  test('handles weather service errors gracefully', async () => {
    const failingWeatherService = {
      getExtendedForecast: async () => {
        throw new Error('API error');
      },
    };

    // Should not throw, should return prediction without weather
    const prediction = await predictHarvestWithWeather(
      mockBokChoy,
      plantingDate,
      'central',
      failingWeatherService
    );

    expect(prediction.cropId).toBe('bok-choy');
  });
});

describe('confidence scoring', () => {
  const plantingDate = new Date('2025-01-15');

  test('confidence is bounded between 0.3 and 0.95', () => {
    const prediction = predictHarvest(mockBokChoy, plantingDate);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0.3);
    expect(prediction.confidence).toBeLessThanOrEqual(0.95);
  });

  test('weather data increases confidence compared to no weather', () => {
    const weather7Days: WeatherData[] = Array(7)
      .fill(null)
      .map((_, i) => ({
        date: new Date(plantingDate.getTime() + i * 24 * 60 * 60 * 1000),
        temperatureMin: 18,
        temperatureMax: 25,
        rainfall: 5,
      }));

    const predictionNoWeather = predictHarvest(mockBokChoy, plantingDate);
    const predictionWithWeather = predictHarvest(mockBokChoy, plantingDate, {
      weather: weather7Days,
    });

    expect(predictionWithWeather.confidence).toBeGreaterThan(predictionNoWeather.confidence);
  });
});
