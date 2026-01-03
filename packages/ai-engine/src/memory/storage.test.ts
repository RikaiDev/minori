/**
 * Tests for memory storage implementations.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { InMemoryMemoryStorage } from './storage';

describe('InMemoryMemoryStorage', () => {
  let storage: InMemoryMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryMemoryStorage();
  });

  describe('upsert', () => {
    test('creates new memory entry', async () => {
      const result = await storage.upsert('user1', 'test_key', 'preference', { locale: 'zh-TW' });

      expect(result.created).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.memory.userId).toBe('user1');
      expect(result.memory.key).toBe('test_key');
      expect(result.memory.type).toBe('preference');
      expect(result.memory.value).toEqual({ locale: 'zh-TW' });
      expect(result.memory.confidence).toBe(0.5);
      expect(result.memory.reinforceCount).toBe(0);
    });

    test('updates existing memory entry', async () => {
      await storage.upsert('user1', 'test_key', 'preference', { locale: 'zh-TW' });
      const result = await storage.upsert(
        'user1',
        'test_key',
        'preference',
        { locale: 'en' },
        { confidence: 0.9 }
      );

      expect(result.created).toBe(false);
      expect(result.updated).toBe(true);
      expect(result.memory.value).toEqual({ locale: 'en' });
      expect(result.memory.confidence).toBe(0.9);
    });

    test('sets custom confidence', async () => {
      const result = await storage.upsert('user1', 'test_key', 'preference', 'value', {
        confidence: 0.8,
      });

      expect(result.memory.confidence).toBe(0.8);
    });

    test('sets expiration date', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      const result = await storage.upsert('user1', 'test_key', 'fact', 'value', { expiresAt });

      expect(result.memory.expiresAt).toEqual(expiresAt);
    });
  });

  describe('get', () => {
    test('returns memory by ID', async () => {
      const { memory } = await storage.upsert('user1', 'key1', 'preference', 'value');
      const result = await storage.get(memory.id);

      expect(result).toEqual(memory);
    });

    test('returns null for non-existent ID', async () => {
      const result = await storage.get('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getByKey', () => {
    test('returns memory by user ID and key', async () => {
      await storage.upsert('user1', 'key1', 'preference', 'value1');
      await storage.upsert('user1', 'key2', 'preference', 'value2');

      const result = await storage.getByKey('user1', 'key1');
      expect(result?.value).toBe('value1');
    });

    test('returns null for non-existent key', async () => {
      const result = await storage.getByKey('user1', 'non-existent');
      expect(result).toBeNull();
    });

    test('returns null for wrong user', async () => {
      await storage.upsert('user1', 'key1', 'preference', 'value');
      const result = await storage.getByKey('user2', 'key1');
      expect(result).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await storage.upsert('user1', 'pref1', 'preference', 'v1', { confidence: 0.9 });
      await storage.upsert('user1', 'pref2', 'preference', 'v2', { confidence: 0.7 });
      await storage.upsert('user1', 'fact1', 'fact', 'v3', { confidence: 0.8 });
      await storage.upsert('user2', 'pref1', 'preference', 'v4');
    });

    test('returns all memories for user', async () => {
      const results = await storage.query('user1');
      expect(results).toHaveLength(3);
    });

    test('filters by type', async () => {
      const results = await storage.query('user1', { type: 'preference' });
      expect(results).toHaveLength(2);
      expect(results.every((m) => m.type === 'preference')).toBe(true);
    });

    test('filters by key pattern', async () => {
      const results = await storage.query('user1', { keyPattern: '^pref' });
      expect(results).toHaveLength(2);
    });

    test('filters by minimum confidence', async () => {
      const results = await storage.query('user1', { minConfidence: 0.8 });
      expect(results).toHaveLength(2);
    });

    test('sorts by confidence ascending', async () => {
      const results = await storage.query('user1', {
        sortBy: 'confidence',
        sortOrder: 'asc',
      });
      expect(results[0]!.confidence).toBe(0.7);
      expect(results[2]!.confidence).toBe(0.9);
    });

    test('sorts by confidence descending', async () => {
      const results = await storage.query('user1', {
        sortBy: 'confidence',
        sortOrder: 'desc',
      });
      expect(results[0]!.confidence).toBe(0.9);
      expect(results[2]!.confidence).toBe(0.7);
    });

    test('limits results', async () => {
      const results = await storage.query('user1', { limit: 2 });
      expect(results).toHaveLength(2);
    });

    test('returns empty array for non-existent user', async () => {
      const results = await storage.query('non-existent');
      expect(results).toEqual([]);
    });

    test('excludes expired memories by default', async () => {
      await storage.upsert('user1', 'expired', 'fact', 'v5', {
        expiresAt: new Date(Date.now() - 1000),
      });

      const results = await storage.query('user1');
      expect(results.find((m) => m.key === 'expired')).toBeUndefined();
    });

    test('includes expired memories when requested', async () => {
      await storage.upsert('user1', 'expired', 'fact', 'v5', {
        expiresAt: new Date(Date.now() - 1000),
      });

      const results = await storage.query('user1', { includeExpired: true });
      expect(results.find((m) => m.key === 'expired')).toBeDefined();
    });
  });

  describe('delete', () => {
    test('deletes memory by ID', async () => {
      const { memory } = await storage.upsert('user1', 'key1', 'preference', 'value');
      const deleted = await storage.delete(memory.id);

      expect(deleted).toBe(true);
      expect(await storage.get(memory.id)).toBeNull();
    });

    test('returns false for non-existent ID', async () => {
      const deleted = await storage.delete('non-existent');
      expect(deleted).toBe(false);
    });

    test('updates indexes after delete', async () => {
      const { memory } = await storage.upsert('user1', 'key1', 'preference', 'value');
      await storage.delete(memory.id);

      expect(await storage.getByKey('user1', 'key1')).toBeNull();
      expect(await storage.count('user1')).toBe(0);
    });
  });

  describe('deleteAllForUser', () => {
    test('deletes all memories for user', async () => {
      await storage.upsert('user1', 'key1', 'preference', 'v1');
      await storage.upsert('user1', 'key2', 'fact', 'v2');
      await storage.upsert('user2', 'key1', 'preference', 'v3');

      const count = await storage.deleteAllForUser('user1');

      expect(count).toBe(2);
      expect(await storage.count('user1')).toBe(0);
      expect(await storage.count('user2')).toBe(1);
    });

    test('returns 0 for non-existent user', async () => {
      const count = await storage.deleteAllForUser('non-existent');
      expect(count).toBe(0);
    });
  });

  describe('reinforce', () => {
    test('increases reinforce count', async () => {
      const { memory } = await storage.upsert('user1', 'key1', 'preference', 'value');

      const reinforced = await storage.reinforce(memory.id);

      expect(reinforced?.reinforceCount).toBe(1);
    });

    test('increases confidence with diminishing returns', async () => {
      const { memory } = await storage.upsert('user1', 'key1', 'preference', 'value', {
        confidence: 0.5,
      });

      const reinforced = await storage.reinforce(memory.id);

      expect(reinforced?.confidence).toBeGreaterThan(0.5);
      expect(reinforced?.confidence).toBeLessThan(0.6);
    });

    test('caps confidence at 1.0', async () => {
      const { memory } = await storage.upsert('user1', 'key1', 'preference', 'value', {
        confidence: 0.99,
      });

      const reinforced = await storage.reinforce(memory.id);

      expect(reinforced?.confidence).toBeLessThanOrEqual(1.0);
    });

    test('returns null for non-existent ID', async () => {
      const result = await storage.reinforce('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('touch', () => {
    test('updates lastAccessedAt', async () => {
      const { memory } = await storage.upsert('user1', 'key1', 'preference', 'value');
      const originalAccessTime = memory.lastAccessedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await storage.touch(memory.id);

      const updated = await storage.get(memory.id);
      expect(updated?.lastAccessedAt.getTime()).toBeGreaterThan(originalAccessTime.getTime());
    });
  });

  describe('cleanupExpired', () => {
    test('removes expired memories', async () => {
      await storage.upsert('user1', 'active', 'preference', 'v1');
      await storage.upsert('user1', 'expired1', 'fact', 'v2', {
        expiresAt: new Date(Date.now() - 1000),
      });
      await storage.upsert('user1', 'expired2', 'fact', 'v3', {
        expiresAt: new Date(Date.now() - 2000),
      });

      const count = await storage.cleanupExpired();

      expect(count).toBe(2);
      expect(await storage.count('user1')).toBe(1);
    });

    test('keeps non-expired memories', async () => {
      await storage.upsert('user1', 'future', 'preference', 'v1', {
        expiresAt: new Date(Date.now() + 3600000),
      });

      const count = await storage.cleanupExpired();

      expect(count).toBe(0);
      expect(await storage.count('user1')).toBe(1);
    });
  });

  describe('count', () => {
    test('returns correct count', async () => {
      await storage.upsert('user1', 'key1', 'preference', 'v1');
      await storage.upsert('user1', 'key2', 'preference', 'v2');
      await storage.upsert('user1', 'key3', 'fact', 'v3');

      const count = await storage.count('user1');
      expect(count).toBe(3);
    });

    test('returns 0 for non-existent user', async () => {
      const count = await storage.count('non-existent');
      expect(count).toBe(0);
    });
  });

  describe('clear', () => {
    test('removes all memories', async () => {
      await storage.upsert('user1', 'key1', 'preference', 'v1');
      await storage.upsert('user2', 'key2', 'fact', 'v2');

      storage.clear();

      expect(await storage.count('user1')).toBe(0);
      expect(await storage.count('user2')).toBe(0);
    });
  });
});
