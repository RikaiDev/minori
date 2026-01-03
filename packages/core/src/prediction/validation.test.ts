/**
 * Unit tests for Prediction Validation module.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import {
  PredictionValidator,
  InMemoryValidationStorage,
  createPredictionValidator,
  type ValidationRecord,
} from './validation';
import type { HarvestPrediction } from '@minori/shared';

// Helper to create a mock prediction
function createMockPrediction(
  cropId: string,
  plantingDate: Date,
  likelyHarvestDate: Date
): HarvestPrediction {
  const daysToHarvest = Math.round(
    (likelyHarvestDate.getTime() - plantingDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    cropId,
    plantingDate,
    predictions: {
      earliest: new Date(likelyHarvestDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      likely: likelyHarvestDate,
      latest: new Date(likelyHarvestDate.getTime() + 7 * 24 * 60 * 60 * 1000),
    },
    confidence: 0.8,
    factors: {
      baseGrowthDays: daysToHarvest,
      temperatureAdjustment: 1,
      rainfallAdjustment: 1,
    },
  };
}

describe('InMemoryValidationStorage', () => {
  let storage: InMemoryValidationStorage;

  beforeEach(() => {
    storage = new InMemoryValidationStorage();
  });

  test('saves and retrieves a record', async () => {
    const record: ValidationRecord = {
      id: 'test-1',
      cropId: 'bok-choy',
      prediction: createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      actualHarvestDate: new Date('2025-01-30'),
      errorDays: 2,
      isAccurate: true,
      validatedAt: new Date(),
    };

    await storage.save(record);
    const retrieved = await storage.getById('test-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.cropId).toBe('bok-choy');
  });

  test('returns null for non-existent record', async () => {
    const result = await storage.getById('non-existent');
    expect(result).toBeNull();
  });

  test('gets all records', async () => {
    await storage.save({
      id: 'test-1',
      cropId: 'bok-choy',
      prediction: createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      actualHarvestDate: new Date('2025-01-30'),
      errorDays: 2,
      isAccurate: true,
      validatedAt: new Date(),
    });
    await storage.save({
      id: 'test-2',
      cropId: 'tomato',
      prediction: createMockPrediction('tomato', new Date('2025-01-01'), new Date('2025-03-15')),
      actualHarvestDate: new Date('2025-03-20'),
      errorDays: 5,
      isAccurate: true,
      validatedAt: new Date(),
    });

    const all = await storage.getAll();
    expect(all.length).toBe(2);
  });

  test('filters by crop', async () => {
    await storage.save({
      id: 'test-1',
      cropId: 'bok-choy',
      prediction: createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      actualHarvestDate: new Date('2025-01-30'),
      errorDays: 2,
      isAccurate: true,
      validatedAt: new Date(),
    });
    await storage.save({
      id: 'test-2',
      cropId: 'tomato',
      prediction: createMockPrediction('tomato', new Date('2025-01-01'), new Date('2025-03-15')),
      actualHarvestDate: new Date('2025-03-20'),
      errorDays: 5,
      isAccurate: true,
      validatedAt: new Date(),
    });

    const bokChoyRecords = await storage.getByCrop('bok-choy');
    expect(bokChoyRecords.length).toBe(1);
    expect(bokChoyRecords[0]?.cropId).toBe('bok-choy');
  });

  test('filters by region', async () => {
    await storage.save({
      id: 'test-1',
      cropId: 'bok-choy',
      region: 'north',
      prediction: createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      actualHarvestDate: new Date('2025-01-30'),
      errorDays: 2,
      isAccurate: true,
      validatedAt: new Date(),
    });
    await storage.save({
      id: 'test-2',
      cropId: 'tomato',
      region: 'south',
      prediction: createMockPrediction('tomato', new Date('2025-01-01'), new Date('2025-03-15')),
      actualHarvestDate: new Date('2025-03-20'),
      errorDays: 5,
      isAccurate: true,
      validatedAt: new Date(),
    });

    const northRecords = await storage.getByRegion('north');
    expect(northRecords.length).toBe(1);
    expect(northRecords[0]?.region).toBe('north');
  });

  test('gets recent records in order', async () => {
    await storage.save({
      id: 'test-1',
      cropId: 'bok-choy',
      prediction: createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      actualHarvestDate: new Date('2025-01-30'),
      errorDays: 2,
      isAccurate: true,
      validatedAt: new Date('2025-01-30'),
    });
    await storage.save({
      id: 'test-2',
      cropId: 'tomato',
      prediction: createMockPrediction('tomato', new Date('2025-01-01'), new Date('2025-03-15')),
      actualHarvestDate: new Date('2025-03-20'),
      errorDays: 5,
      isAccurate: true,
      validatedAt: new Date('2025-03-20'),
    });

    const recent = await storage.getRecent(1);
    expect(recent.length).toBe(1);
    expect(recent[0]?.cropId).toBe('tomato'); // More recent
  });

  test('deletes a record', async () => {
    await storage.save({
      id: 'test-1',
      cropId: 'bok-choy',
      prediction: createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      actualHarvestDate: new Date('2025-01-30'),
      errorDays: 2,
      isAccurate: true,
      validatedAt: new Date(),
    });

    await storage.delete('test-1');
    const result = await storage.getById('test-1');
    expect(result).toBeNull();
  });

  test('clears all records', async () => {
    await storage.save({
      id: 'test-1',
      cropId: 'bok-choy',
      prediction: createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      actualHarvestDate: new Date('2025-01-30'),
      errorDays: 2,
      isAccurate: true,
      validatedAt: new Date(),
    });

    await storage.clear();
    const all = await storage.getAll();
    expect(all.length).toBe(0);
  });
});

describe('PredictionValidator', () => {
  let validator: PredictionValidator;

  beforeEach(() => {
    validator = createPredictionValidator();
  });

  test('validates a prediction correctly', async () => {
    const prediction = createMockPrediction(
      'bok-choy',
      new Date('2025-01-01'),
      new Date('2025-01-28')
    );
    const actualDate = new Date('2025-01-30'); // 2 days later

    const record = await validator.validate(prediction, actualDate);

    expect(record.cropId).toBe('bok-choy');
    expect(record.errorDays).toBe(2);
    expect(record.isAccurate).toBe(true); // Within 7 days
  });

  test('marks prediction as inaccurate when error exceeds threshold', async () => {
    const prediction = createMockPrediction(
      'bok-choy',
      new Date('2025-01-01'),
      new Date('2025-01-28')
    );
    const actualDate = new Date('2025-02-10'); // 13 days later

    const record = await validator.validate(prediction, actualDate);

    expect(record.errorDays).toBe(13);
    expect(record.isAccurate).toBe(false); // Beyond 7 days
  });

  test('handles early harvests correctly', async () => {
    const prediction = createMockPrediction(
      'bok-choy',
      new Date('2025-01-01'),
      new Date('2025-01-28')
    );
    const actualDate = new Date('2025-01-25'); // 3 days early

    const record = await validator.validate(prediction, actualDate);

    expect(record.errorDays).toBe(-3); // Negative = early
    expect(record.isAccurate).toBe(true); // Within 7 days
  });

  test('includes region in validation record', async () => {
    const prediction = createMockPrediction(
      'bok-choy',
      new Date('2025-01-01'),
      new Date('2025-01-28')
    );
    const actualDate = new Date('2025-01-30');

    const record = await validator.validate(prediction, actualDate, { region: 'central' });

    expect(record.region).toBe('central');
  });

  test('includes notes in validation record', async () => {
    const prediction = createMockPrediction(
      'bok-choy',
      new Date('2025-01-01'),
      new Date('2025-01-28')
    );
    const actualDate = new Date('2025-01-30');

    const record = await validator.validate(prediction, actualDate, {
      notes: 'Delayed due to pest damage',
    });

    expect(record.notes).toBe('Delayed due to pest damage');
  });
});

describe('AccuracyMetrics', () => {
  let validator: PredictionValidator;

  beforeEach(async () => {
    validator = createPredictionValidator();

    // Add some validation records
    // Accurate predictions (within 7 days)
    await validator.validate(
      createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      new Date('2025-01-30'), // +2 days
      { region: 'central' }
    );
    await validator.validate(
      createMockPrediction('bok-choy', new Date('2025-02-01'), new Date('2025-02-28')),
      new Date('2025-02-25'), // -3 days
      { region: 'central' }
    );
    await validator.validate(
      createMockPrediction('tomato', new Date('2025-01-01'), new Date('2025-03-15')),
      new Date('2025-03-17'), // +2 days
      { region: 'south' }
    );

    // Inaccurate prediction (beyond 7 days)
    await validator.validate(
      createMockPrediction('tomato', new Date('2025-02-01'), new Date('2025-04-15')),
      new Date('2025-04-30'), // +15 days
      { region: 'south' }
    );
  });

  test('calculates overall metrics correctly', async () => {
    const metrics = await validator.getOverallMetrics();

    expect(metrics.totalPredictions).toBe(4);
    expect(metrics.accuratePredictions).toBe(3);
    expect(metrics.accuracyRate).toBe(0.75);
  });

  test('calculates mean absolute error', async () => {
    const metrics = await validator.getOverallMetrics();

    // Errors: 2, -3, 2, 15 → abs: 2, 3, 2, 15 → mean: 5.5
    expect(metrics.meanAbsoluteError).toBe(5.5);
  });

  test('calculates mean error', async () => {
    const metrics = await validator.getOverallMetrics();

    // Errors: 2, -3, 2, 15 → mean: 16/4 = 4
    expect(metrics.meanError).toBe(4);
  });

  test('gets metrics breakdown', async () => {
    const breakdown = await validator.getMetricsBreakdown();

    expect(breakdown.overall.totalPredictions).toBe(4);
    expect(breakdown.byCrop.get('bok-choy')?.totalPredictions).toBe(2);
    expect(breakdown.byCrop.get('tomato')?.totalPredictions).toBe(2);
    expect(breakdown.byRegion.get('central')?.totalPredictions).toBe(2);
    expect(breakdown.byRegion.get('south')?.totalPredictions).toBe(2);
  });

  test('gets crop-specific metrics', async () => {
    const bokChoyMetrics = await validator.getCropMetrics('bok-choy');

    expect(bokChoyMetrics.totalPredictions).toBe(2);
    expect(bokChoyMetrics.accuratePredictions).toBe(2);
    expect(bokChoyMetrics.accuracyRate).toBe(1); // All accurate
  });

  test('gets region-specific metrics', async () => {
    const southMetrics = await validator.getRegionMetrics('south');

    expect(southMetrics.totalPredictions).toBe(2);
    expect(southMetrics.accuratePredictions).toBe(1);
    expect(southMetrics.accuracyRate).toBe(0.5);
  });
});

describe('checkAccuracyTarget', () => {
  let validator: PredictionValidator;

  beforeEach(() => {
    validator = createPredictionValidator();
  });

  test('fails when insufficient samples', async () => {
    await validator.validate(
      createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      new Date('2025-01-30')
    );

    const result = await validator.checkAccuracyTarget(0.8, 10);

    expect(result.passes).toBe(false);
    expect(result.message).toContain('Insufficient data');
  });

  test('passes when accuracy meets target', async () => {
    // Add 10 accurate predictions
    for (let i = 0; i < 10; i++) {
      await validator.validate(
        createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
        new Date('2025-01-30') // +2 days, accurate
      );
    }

    const result = await validator.checkAccuracyTarget(0.8, 10);

    expect(result.passes).toBe(true);
    expect(result.metrics.accuracyRate).toBe(1);
  });

  test('fails when accuracy below target', async () => {
    // Add 5 accurate and 5 inaccurate predictions
    for (let i = 0; i < 5; i++) {
      await validator.validate(
        createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
        new Date('2025-01-30') // +2 days, accurate
      );
    }
    for (let i = 0; i < 5; i++) {
      await validator.validate(
        createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
        new Date('2025-02-15') // +18 days, inaccurate
      );
    }

    const result = await validator.checkAccuracyTarget(0.8, 10);

    expect(result.passes).toBe(false);
    expect(result.metrics.accuracyRate).toBe(0.5);
  });
});

describe('createPredictionValidator', () => {
  test('creates validator with default threshold', () => {
    const validator = createPredictionValidator();
    expect(validator).toBeInstanceOf(PredictionValidator);
  });

  test('creates validator with custom threshold', async () => {
    const validator = createPredictionValidator(undefined, 3); // 3-day threshold

    const prediction = createMockPrediction(
      'bok-choy',
      new Date('2025-01-01'),
      new Date('2025-01-28')
    );

    // 5 days error should be inaccurate with 3-day threshold
    const record = await validator.validate(prediction, new Date('2025-02-02'));
    expect(record.isAccurate).toBe(false);

    // 2 days error should be accurate with 3-day threshold
    const record2 = await validator.validate(prediction, new Date('2025-01-30'));
    expect(record2.isAccurate).toBe(true);
  });

  test('creates validator with custom storage', async () => {
    const customStorage = new InMemoryValidationStorage();
    const validator = createPredictionValidator(customStorage);

    await validator.validate(
      createMockPrediction('bok-choy', new Date('2025-01-01'), new Date('2025-01-28')),
      new Date('2025-01-30')
    );

    const records = await customStorage.getAll();
    expect(records.length).toBe(1);
  });
});
