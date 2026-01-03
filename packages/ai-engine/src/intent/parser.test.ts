/**
 * Unit tests for Intent Parser module.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import {
  parseDateExpression,
  getMissingEntities,
  isIntentComplete,
  IntentParseError,
  CONFIDENCE_THRESHOLD,
  UNKNOWN_THRESHOLD,
} from './parser';
import type { ParsedIntent } from '@minori/shared';

describe('parseDateExpression', () => {
  let today: Date;

  beforeEach(() => {
    today = new Date();
    today.setHours(0, 0, 0, 0);
  });

  test('parses 今天 as today', () => {
    const result = parseDateExpression('今天');
    expect(result.getTime()).toBe(today.getTime());
  });

  test('parses 今日 as today', () => {
    const result = parseDateExpression('今日');
    expect(result.getTime()).toBe(today.getTime());
  });

  test('parses 昨天 as yesterday', () => {
    const result = parseDateExpression('昨天');
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBe(yesterday.getTime());
  });

  test('parses 昨日 as yesterday', () => {
    const result = parseDateExpression('昨日');
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBe(yesterday.getTime());
  });

  test('parses 前天 as day before yesterday', () => {
    const result = parseDateExpression('前天');
    const dayBeforeYesterday = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBe(dayBeforeYesterday.getTime());
  });

  test('parses 上禮拜 as last week', () => {
    const result = parseDateExpression('上禮拜');
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBe(lastWeek.getTime());
  });

  test('parses 上週 as last week', () => {
    const result = parseDateExpression('上週');
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(result.getTime()).toBe(lastWeek.getTime());
  });

  test('parses 這禮拜 as this week (today)', () => {
    const result = parseDateExpression('這禮拜');
    expect(result.getTime()).toBe(today.getTime());
  });

  test('defaults to today for unrecognized expression', () => {
    const result = parseDateExpression('some random text');
    expect(result.getTime()).toBe(today.getTime());
  });

  test('handles expressions with context', () => {
    const result = parseDateExpression('我今天種了菜');
    expect(result.getTime()).toBe(today.getTime());
  });
});

describe('getMissingEntities', () => {
  test('returns empty array for complete planting intent', () => {
    const intent: ParsedIntent = {
      action: 'record_planting',
      entities: { crop: '小白菜', area: 2 },
      confidence: 0.9,
      rawText: '種了兩分地的小白菜',
    };
    expect(getMissingEntities(intent)).toEqual([]);
  });

  test('returns crop when missing from planting intent', () => {
    const intent: ParsedIntent = {
      action: 'record_planting',
      entities: { area: 2 },
      confidence: 0.5,
      rawText: '種了兩分地',
    };
    expect(getMissingEntities(intent)).toContain('crop');
  });

  test('returns area when missing from planting intent', () => {
    const intent: ParsedIntent = {
      action: 'record_planting',
      entities: { crop: '小白菜' },
      confidence: 0.5,
      rawText: '種了小白菜',
    };
    expect(getMissingEntities(intent)).toContain('area');
  });

  test('returns both crop and area when both missing', () => {
    const intent: ParsedIntent = {
      action: 'record_planting',
      entities: {},
      confidence: 0.3,
      rawText: '種了',
    };
    const missing = getMissingEntities(intent);
    expect(missing).toContain('crop');
    expect(missing).toContain('area');
  });

  test('returns empty array for complete harvest intent', () => {
    const intent: ParsedIntent = {
      action: 'record_harvest',
      entities: { crop: '空心菜', quantity: 50 },
      confidence: 0.9,
      rawText: '收了五十公斤空心菜',
    };
    expect(getMissingEntities(intent)).toEqual([]);
  });

  test('returns crop when missing from harvest intent', () => {
    const intent: ParsedIntent = {
      action: 'record_harvest',
      entities: { quantity: 50 },
      confidence: 0.5,
      rawText: '收了五十公斤',
    };
    expect(getMissingEntities(intent)).toContain('crop');
  });

  test('returns quantity when missing from harvest intent', () => {
    const intent: ParsedIntent = {
      action: 'record_harvest',
      entities: { crop: '空心菜' },
      confidence: 0.5,
      rawText: '收了空心菜',
    };
    expect(getMissingEntities(intent)).toContain('quantity');
  });

  test('returns empty array for query intents (not strictly required)', () => {
    const intent: ParsedIntent = {
      action: 'query_price',
      entities: {},
      confidence: 0.7,
      rawText: '現在什麼價',
    };
    expect(getMissingEntities(intent)).toEqual([]);
  });

  test('returns empty array for unknown intent', () => {
    const intent: ParsedIntent = {
      action: 'unknown',
      entities: {},
      confidence: 0,
      rawText: 'asdf',
    };
    expect(getMissingEntities(intent)).toEqual([]);
  });
});

describe('isIntentComplete', () => {
  test('returns true for complete planting intent', () => {
    const intent: ParsedIntent = {
      action: 'record_planting',
      entities: { crop: '小白菜', area: 2 },
      confidence: 0.9,
      rawText: '種了兩分地的小白菜',
    };
    expect(isIntentComplete(intent)).toBe(true);
  });

  test('returns false for incomplete planting intent', () => {
    const intent: ParsedIntent = {
      action: 'record_planting',
      entities: { crop: '小白菜' },
      confidence: 0.5,
      rawText: '種了小白菜',
    };
    expect(isIntentComplete(intent)).toBe(false);
  });

  test('returns true for complete harvest intent', () => {
    const intent: ParsedIntent = {
      action: 'record_harvest',
      entities: { crop: '空心菜', quantity: 50 },
      confidence: 0.9,
      rawText: '收了五十公斤空心菜',
    };
    expect(isIntentComplete(intent)).toBe(true);
  });

  test('returns false for incomplete harvest intent', () => {
    const intent: ParsedIntent = {
      action: 'record_harvest',
      entities: { crop: '空心菜' },
      confidence: 0.5,
      rawText: '收了空心菜',
    };
    expect(isIntentComplete(intent)).toBe(false);
  });

  test('returns true for query intents without crop', () => {
    const intent: ParsedIntent = {
      action: 'query_crops',
      entities: {},
      confidence: 0.8,
      rawText: '我種了什麼',
    };
    expect(isIntentComplete(intent)).toBe(true);
  });

  test('returns true for help intent', () => {
    const intent: ParsedIntent = {
      action: 'help',
      entities: {},
      confidence: 0.9,
      rawText: '怎麼用',
    };
    expect(isIntentComplete(intent)).toBe(true);
  });
});

describe('IntentParseError', () => {
  test('creates error with code and message', () => {
    const error = new IntentParseError('Test error', 'API_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('API_ERROR');
    expect(error.name).toBe('IntentParseError');
  });

  test('includes originalError when provided', () => {
    const originalError = new Error('Original error');
    const error = new IntentParseError('Wrapped error', 'UNKNOWN', originalError);
    expect(error.originalError).toBe(originalError);
  });

  test('supports all error codes', () => {
    const codes = ['API_ERROR', 'PARSE_ERROR', 'RATE_LIMITED', 'UNKNOWN'] as const;
    for (const code of codes) {
      const error = new IntentParseError('Test', code);
      expect(error.code).toBe(code);
    }
  });
});

describe('confidence thresholds', () => {
  test('CONFIDENCE_THRESHOLD is 0.7', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.7);
  });

  test('UNKNOWN_THRESHOLD is 0.3', () => {
    expect(UNKNOWN_THRESHOLD).toBe(0.3);
  });

  test('UNKNOWN_THRESHOLD is less than CONFIDENCE_THRESHOLD', () => {
    expect(UNKNOWN_THRESHOLD).toBeLessThan(CONFIDENCE_THRESHOLD);
  });
});

// Note: Integration tests for parseIntent() and parseIntentWithClarification()
// would require mocking OpenAI API or using actual API calls.
// Those tests should be in a separate integration test suite.
