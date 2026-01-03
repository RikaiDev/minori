/**
 * Unit tests for database utilities.
 */

import { describe, expect, test } from 'bun:test';
import { createId, createCode } from './utils';

describe('createId', () => {
  test('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createId());
    }
    expect(ids.size).toBe(100);
  });

  test('generates non-empty strings', () => {
    const id = createId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('generates IDs with expected format', () => {
    const id = createId();
    // Should be alphanumeric
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});

describe('createCode', () => {
  test('generates code with default length', () => {
    const code = createCode();
    expect(code.length).toBe(8);
  });

  test('generates code with custom length', () => {
    const code = createCode(12);
    expect(code.length).toBe(12);
  });

  test('generates unique codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(createCode());
    }
    expect(codes.size).toBe(100);
  });

  test('generates lowercase alphanumeric codes', () => {
    const code = createCode(20);
    expect(code).toMatch(/^[a-z0-9]+$/);
  });
});
