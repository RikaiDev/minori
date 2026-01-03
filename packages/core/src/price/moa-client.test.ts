/**
 * Unit tests for MOA API Client.
 */

import { describe, expect, test } from 'bun:test';
import { toROCDate, fromROCDate, MOAClient, MOAClientError } from './moa-client';

describe('toROCDate', () => {
  test('converts 2024-01-15 to 113.01.15', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(toROCDate(date)).toBe('113.01.15');
  });

  test('converts 2025-12-31 to 114.12.31', () => {
    const date = new Date(2025, 11, 31); // Dec 31, 2025
    expect(toROCDate(date)).toBe('114.12.31');
  });

  test('pads month and day with zeros', () => {
    const date = new Date(2024, 0, 5); // Jan 5, 2024
    expect(toROCDate(date)).toBe('113.01.05');
  });

  test('handles year 2000 correctly', () => {
    const date = new Date(2000, 5, 15); // Jun 15, 2000
    expect(toROCDate(date)).toBe('89.06.15');
  });
});

describe('fromROCDate', () => {
  test('converts 113.01.15 to Jan 15, 2024', () => {
    const date = fromROCDate('113.01.15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(15);
  });

  test('converts 114.12.31 to Dec 31, 2025', () => {
    const date = fromROCDate('114.12.31');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11); // December
    expect(date.getDate()).toBe(31);
  });

  test('throws error for invalid format', () => {
    expect(() => fromROCDate('invalid')).toThrow(MOAClientError);
  });

  test('throws error for incomplete date', () => {
    expect(() => fromROCDate('113.01')).toThrow(MOAClientError);
  });
});

describe('ROC date conversion round-trip', () => {
  test('converts back and forth correctly', () => {
    const originalDate = new Date(2024, 6, 20); // Jul 20, 2024
    const rocDate = toROCDate(originalDate);
    const convertedBack = fromROCDate(rocDate);

    expect(convertedBack.getFullYear()).toBe(originalDate.getFullYear());
    expect(convertedBack.getMonth()).toBe(originalDate.getMonth());
    expect(convertedBack.getDate()).toBe(originalDate.getDate());
  });
});

describe('MOAClient', () => {
  test('creates client instance', () => {
    const client = new MOAClient();
    expect(client).toBeInstanceOf(MOAClient);
  });
});

describe('MOAClientError', () => {
  test('has correct error code', () => {
    const error = new MOAClientError('Test error', 'API_ERROR');
    expect(error.code).toBe('API_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('MOAClientError');
  });

  test('supports different error codes', () => {
    const errors = [
      new MOAClientError('API error', 'API_ERROR'),
      new MOAClientError('Invalid response', 'INVALID_RESPONSE'),
      new MOAClientError('Fetch error', 'FETCH_ERROR'),
      new MOAClientError('Invalid date', 'INVALID_DATE'),
    ];

    expect(errors[0]!.code).toBe('API_ERROR');
    expect(errors[1]!.code).toBe('INVALID_RESPONSE');
    expect(errors[2]!.code).toBe('FETCH_ERROR');
    expect(errors[3]!.code).toBe('INVALID_DATE');
  });
});
