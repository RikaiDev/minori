/**
 * Unit tests for Crop Identification module.
 */

import { describe, expect, test } from 'bun:test';
import {
  CropIdentificationError,
  isReliableIdentification,
  isUnrecognized,
  IDENTIFICATION_CONFIDENCE_THRESHOLD,
  UNRECOGNIZED_THRESHOLD,
  type CropIdentificationResult,
} from './crop-identifier';

describe('CropIdentificationError', () => {
  test('creates error with code and message', () => {
    const error = new CropIdentificationError('Test error', 'API_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('API_ERROR');
    expect(error.name).toBe('CropIdentificationError');
  });

  test('includes originalError when provided', () => {
    const originalError = new Error('Original error');
    const error = new CropIdentificationError('Wrapped error', 'UNKNOWN', originalError);
    expect(error.originalError).toBe(originalError);
  });

  test('supports all error codes', () => {
    const codes = ['INVALID_IMAGE', 'API_ERROR', 'RATE_LIMITED', 'TIMEOUT', 'UNKNOWN'] as const;
    for (const code of codes) {
      const error = new CropIdentificationError('Test', code);
      expect(error.code).toBe(code);
    }
  });
});

describe('confidence thresholds', () => {
  test('IDENTIFICATION_CONFIDENCE_THRESHOLD is 0.7', () => {
    expect(IDENTIFICATION_CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  test('UNRECOGNIZED_THRESHOLD is 0.3', () => {
    expect(UNRECOGNIZED_THRESHOLD).toBe(0.3);
  });

  test('UNRECOGNIZED_THRESHOLD is less than IDENTIFICATION_CONFIDENCE_THRESHOLD', () => {
    expect(UNRECOGNIZED_THRESHOLD).toBeLessThan(IDENTIFICATION_CONFIDENCE_THRESHOLD);
  });
});

describe('isReliableIdentification', () => {
  test('returns true for identified crop above threshold', () => {
    const result: CropIdentificationResult = {
      identified: true,
      identifiedName: '小白菜',
      confidence: 0.85,
    };
    expect(isReliableIdentification(result)).toBe(true);
  });

  test('returns true for crop exactly at threshold', () => {
    const result: CropIdentificationResult = {
      identified: true,
      identifiedName: '空心菜',
      confidence: 0.7,
    };
    expect(isReliableIdentification(result)).toBe(true);
  });

  test('returns false for crop below threshold', () => {
    const result: CropIdentificationResult = {
      identified: true,
      identifiedName: '高麗菜',
      confidence: 0.5,
    };
    expect(isReliableIdentification(result)).toBe(false);
  });

  test('returns false when not identified', () => {
    const result: CropIdentificationResult = {
      identified: false,
      confidence: 0.9,
    };
    expect(isReliableIdentification(result)).toBe(false);
  });
});

describe('isUnrecognized', () => {
  test('returns true when not identified', () => {
    const result: CropIdentificationResult = {
      identified: false,
      confidence: 0,
    };
    expect(isUnrecognized(result)).toBe(true);
  });

  test('returns true when confidence below threshold', () => {
    const result: CropIdentificationResult = {
      identified: true,
      identifiedName: '未知作物',
      confidence: 0.2,
    };
    expect(isUnrecognized(result)).toBe(true);
  });

  test('returns false when confidence at threshold', () => {
    const result: CropIdentificationResult = {
      identified: true,
      identifiedName: '小白菜',
      confidence: 0.3,
    };
    expect(isUnrecognized(result)).toBe(false);
  });

  test('returns false when confidence above threshold', () => {
    const result: CropIdentificationResult = {
      identified: true,
      identifiedName: '空心菜',
      confidence: 0.8,
    };
    expect(isUnrecognized(result)).toBe(false);
  });
});

describe('CropIdentificationResult structure', () => {
  test('accepts minimal result', () => {
    const result: CropIdentificationResult = {
      identified: false,
      confidence: 0,
    };
    expect(result.identified).toBe(false);
    expect(result.confidence).toBe(0);
  });

  test('accepts full result with all fields', () => {
    const result: CropIdentificationResult = {
      identified: true,
      identifiedName: '小白菜',
      confidence: 0.95,
      growthStage: 'vegetative',
      healthStatus: 'healthy',
      observations: '葉片翠綠，生長良好',
      alternatives: [
        { name: '青江菜', confidence: 0.6 },
        { name: 'A菜', confidence: 0.3 },
      ],
    };

    expect(result.identified).toBe(true);
    expect(result.identifiedName).toBe('小白菜');
    expect(result.confidence).toBe(0.95);
    expect(result.growthStage).toBe('vegetative');
    expect(result.healthStatus).toBe('healthy');
    expect(result.observations).toBe('葉片翠綠，生長良好');
    expect(result.alternatives).toHaveLength(2);
    const firstAlt = result.alternatives![0]!;
    expect(firstAlt.name).toBe('青江菜');
  });

  test('supports all growth stages', () => {
    const stages = [
      'seedling',
      'vegetative',
      'flowering',
      'fruiting',
      'mature',
      'unknown',
    ] as const;
    for (const stage of stages) {
      const result: CropIdentificationResult = {
        identified: true,
        confidence: 0.8,
        growthStage: stage,
      };
      expect(result.growthStage).toBe(stage);
    }
  });

  test('supports all health statuses', () => {
    const statuses = [
      'healthy',
      'pest_damage',
      'disease',
      'nutrient_deficiency',
      'unknown',
    ] as const;
    for (const status of statuses) {
      const result: CropIdentificationResult = {
        identified: true,
        confidence: 0.8,
        healthStatus: status,
      };
      expect(result.healthStatus).toBe(status);
    }
  });
});

// Note: Integration tests for identifyCrop() and downloadLineImage() would require
// mocking OpenAI API and LINE API or using actual API calls with test images.
// Those tests should be in a separate integration test suite.
