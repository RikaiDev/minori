/**
 * Tests for MemoryManager.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { MemoryManager } from './manager';
import { InMemoryMemoryStorage } from './storage';
import type { CropPattern, EntityMemory, FactMemory, InteractionPattern } from './types';

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let storage: InMemoryMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryMemoryStorage();
    manager = new MemoryManager(storage, {
      maxConversationMessages: 5,
      conversationTimeoutMs: 1000,
      cleanupIntervalMs: 60000,
    });
  });

  afterEach(() => {
    manager.stop();
  });

  describe('Conversation Context (Short-term Memory)', () => {
    test('creates new conversation context', () => {
      const context = manager.getConversation('user1');

      expect(context.userId).toBe('user1');
      expect(context.messages).toEqual([]);
      expect(context.conversationId).toContain('conv_user1_');
    });

    test('returns existing conversation within timeout', () => {
      const context1 = manager.getConversation('user1');
      const context2 = manager.getConversation('user1');

      expect(context1.conversationId).toBe(context2.conversationId);
    });

    test('creates new conversation after timeout', async () => {
      const context1 = manager.getConversation('user1');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const context2 = manager.getConversation('user1');
      expect(context2.conversationId).not.toBe(context1.conversationId);
    });

    test('adds message to conversation', () => {
      manager.addMessage('user1', 'Hello', 'user');
      const context = manager.getConversation('user1');

      expect(context.messages).toHaveLength(1);
      expect(context.messages[0]!.content).toBe('Hello');
      expect(context.messages[0]!.role).toBe('user');
    });

    test('adds message with entities and intent', () => {
      manager.addMessage('user1', 'I planted bok choy', 'user', {
        entities: { crop: 'bok-choy' },
        intent: 'record_planting',
      });

      const context = manager.getConversation('user1');
      expect(context.messages[0]!.entities).toEqual({ crop: 'bok-choy' });
      expect(context.messages[0]!.intent).toBe('record_planting');
    });

    test('trims messages when exceeding limit', () => {
      for (let i = 0; i < 7; i++) {
        manager.addMessage('user1', `Message ${i}`, 'user');
      }

      const context = manager.getConversation('user1');
      expect(context.messages).toHaveLength(5);
      expect(context.messages[0]!.content).toBe('Message 2');
      expect(context.messages[4]!.content).toBe('Message 6');
    });

    test('sets conversation state', () => {
      manager.setConversationState('user1', 'awaiting_area', {
        crop: 'bok-choy',
      });

      const context = manager.getConversation('user1');
      expect(context.state).toBe('awaiting_area');
      expect(context.pendingData).toEqual({ crop: 'bok-choy' });
    });

    test('clears conversation state', () => {
      manager.setConversationState('user1', 'awaiting_area', { crop: 'test' });
      manager.setConversationState('user1', undefined);

      const context = manager.getConversation('user1');
      expect(context.state).toBeUndefined();
    });

    test('gets recent messages', () => {
      for (let i = 0; i < 5; i++) {
        manager.addMessage('user1', `Message ${i}`, 'user');
      }

      const recent = manager.getRecentMessages('user1', 3);
      expect(recent).toHaveLength(3);
      expect(recent[0]!.content).toBe('Message 2');
    });

    test('returns empty array for non-existent user messages', () => {
      const recent = manager.getRecentMessages('non-existent');
      expect(recent).toEqual([]);
    });

    test('clears conversation', () => {
      manager.addMessage('user1', 'Hello', 'user');
      manager.clearConversation('user1');

      const recent = manager.getRecentMessages('user1');
      expect(recent).toEqual([]);
    });
  });

  describe('User Preferences (Long-term Memory)', () => {
    test('returns empty preferences for new user', async () => {
      const prefs = await manager.getPreferences('user1');
      expect(prefs).toEqual({});
    });

    test('stores and retrieves preferences', async () => {
      await manager.updatePreferences('user1', {
        locale: 'zh-TW',
        defaultAreaUnit: 'plot',
      });

      const prefs = await manager.getPreferences('user1');
      expect(prefs.locale).toBe('zh-TW');
      expect(prefs.defaultAreaUnit).toBe('plot');
    });

    test('merges preferences on update', async () => {
      await manager.updatePreferences('user1', { locale: 'zh-TW' });
      await manager.updatePreferences('user1', { defaultAreaUnit: 'jia' });

      const prefs = await manager.getPreferences('user1');
      expect(prefs.locale).toBe('zh-TW');
      expect(prefs.defaultAreaUnit).toBe('jia');
    });
  });

  describe('Crop Patterns', () => {
    test('returns empty array for new user', async () => {
      const patterns = await manager.getCropPatterns('user1');
      expect(patterns).toEqual([]);
    });

    test('stores and retrieves crop pattern', async () => {
      const pattern: CropPattern = {
        cropId: 'bok-choy',
        cropName: '小白菜',
        plantCount: 1,
        harvestCount: 0,
        lastPlantedAt: new Date(),
      };

      await manager.updateCropPattern('user1', pattern);
      const patterns = await manager.getCropPatterns('user1');

      expect(patterns).toHaveLength(1);
      expect(patterns[0]!.cropId).toBe('bok-choy');
      expect(patterns[0]!.plantCount).toBe(1);
    });

    test('accumulates crop pattern counts', async () => {
      const pattern1: CropPattern = {
        cropId: 'bok-choy',
        cropName: '小白菜',
        plantCount: 1,
        harvestCount: 0,
      };

      const pattern2: CropPattern = {
        cropId: 'bok-choy',
        cropName: '小白菜',
        plantCount: 1,
        harvestCount: 1,
      };

      await manager.updateCropPattern('user1', pattern1);
      await manager.updateCropPattern('user1', pattern2);

      const patterns = await manager.getCropPatterns('user1');
      expect(patterns[0]!.plantCount).toBe(2);
      expect(patterns[0]!.harvestCount).toBe(1);
    });
  });

  describe('Entity Memory', () => {
    test('stores and retrieves entities', async () => {
      const entity: EntityMemory = {
        entityType: 'crop',
        value: 'bok-choy',
        normalizedValue: 'bok-choy',
        frequency: 1,
      };

      await manager.storeEntity('user1', entity);
      const entities = await manager.getEntities('user1', 'crop');

      expect(entities).toHaveLength(1);
      expect(entities[0]!.value).toBe('bok-choy');
    });

    test('accumulates entity frequency', async () => {
      const entity: EntityMemory = {
        entityType: 'crop',
        value: 'bok-choy',
        frequency: 1,
      };

      await manager.storeEntity('user1', entity);
      await manager.storeEntity('user1', entity);

      const entities = await manager.getEntities('user1', 'crop');
      expect(entities[0]!.frequency).toBe(2);
    });

    test('filters entities by type', async () => {
      await manager.storeEntity('user1', {
        entityType: 'crop',
        value: 'bok-choy',
        frequency: 1,
      });
      await manager.storeEntity('user1', {
        entityType: 'quantity',
        value: 100,
        frequency: 1,
      });

      const cropEntities = await manager.getEntities('user1', 'crop');
      expect(cropEntities).toHaveLength(1);
      expect(cropEntities[0]!.entityType).toBe('crop');
    });
  });

  describe('Fact Memory', () => {
    test('stores and retrieves facts', async () => {
      const fact: FactMemory = {
        subject: 'user',
        predicate: 'grows',
        object: 'vegetables',
        establishedAt: new Date(),
        permanent: true,
      };

      await manager.storeFact('user1', fact);
      const facts = await manager.getFacts('user1');

      expect(facts).toHaveLength(1);
      expect(facts[0]!.subject).toBe('user');
      expect(facts[0]!.predicate).toBe('grows');
    });

    test('filters facts by subject', async () => {
      await manager.storeFact('user1', {
        subject: 'user',
        predicate: 'grows',
        object: 'vegetables',
        establishedAt: new Date(),
        permanent: true,
      });
      await manager.storeFact('user1', {
        subject: 'field',
        predicate: 'size',
        object: 2,
        establishedAt: new Date(),
        permanent: true,
      });

      const userFacts = await manager.getFacts('user1', 'user');
      expect(userFacts).toHaveLength(1);
      expect(userFacts[0]!.subject).toBe('user');
    });
  });

  describe('Interaction Patterns', () => {
    test('stores and retrieves interaction patterns', async () => {
      const pattern: InteractionPattern = {
        patternType: 'time',
        description: 'morning_activity',
        data: { preferredHour: 7 },
        confidence: 0.8,
      };

      await manager.storeInteractionPattern('user1', pattern);
      const patterns = await manager.getInteractionPatterns('user1');

      expect(patterns).toHaveLength(1);
      expect(patterns[0]!.patternType).toBe('time');
    });
  });

  describe('User Profile', () => {
    test('builds complete user profile', async () => {
      await manager.updatePreferences('user1', { locale: 'zh-TW' });
      await manager.updateCropPattern('user1', {
        cropId: 'bok-choy',
        cropName: '小白菜',
        plantCount: 1,
        harvestCount: 0,
      });
      await manager.storeFact('user1', {
        subject: 'user',
        predicate: 'type',
        object: 'farmer',
        establishedAt: new Date(),
        permanent: true,
      });

      const profile = await manager.getUserProfile('user1');

      expect(profile.userId).toBe('user1');
      expect(profile.preferences.locale).toBe('zh-TW');
      expect(profile.cropPatterns).toHaveLength(1);
      expect(profile.facts).toHaveLength(1);
      expect(profile.totalMemories).toBe(3);
    });
  });

  describe('buildContextForAI', () => {
    test('builds context string with preferences', async () => {
      await manager.updatePreferences('user1', { locale: 'zh-TW' });

      const context = await manager.buildContextForAI('user1');

      expect(context).toContain('locale');
      expect(context).toContain('zh-TW');
    });

    test('builds context string with crop patterns', async () => {
      await manager.updateCropPattern('user1', {
        cropId: 'bok-choy',
        cropName: '小白菜',
        plantCount: 1,
        harvestCount: 0,
      });

      const context = await manager.buildContextForAI('user1');

      expect(context).toContain('Common crops');
      expect(context).toContain('小白菜');
    });

    test('includes conversation state', async () => {
      manager.setConversationState('user1', 'awaiting_area', {
        crop: 'bok-choy',
      });

      const context = await manager.buildContextForAI('user1');

      expect(context).toContain('awaiting_area');
      expect(context).toContain('bok-choy');
    });
  });

  describe('Cleanup', () => {
    test('cleans up expired conversations', async () => {
      manager.addMessage('user1', 'Hello', 'user');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await manager.cleanup();
      expect(result.conversationsCleared).toBe(1);
    });

    test('cleans up expired memories', async () => {
      await storage.upsert('user1', 'expired', 'fact', 'value', {
        expiresAt: new Date(Date.now() - 1000),
      });

      const result = await manager.cleanup();
      expect(result.memoriesDeleted).toBe(1);
    });

    test('deleteUserMemory removes all user data', async () => {
      manager.addMessage('user1', 'Hello', 'user');
      await manager.updatePreferences('user1', { locale: 'zh-TW' });

      await manager.deleteUserMemory('user1');

      const messages = manager.getRecentMessages('user1');
      const prefs = await manager.getPreferences('user1');

      expect(messages).toEqual([]);
      expect(prefs).toEqual({});
    });
  });

  describe('start/stop', () => {
    test('start and stop without errors', () => {
      manager.start();
      expect(() => manager.start()).not.toThrow(); // Idempotent
      expect(() => manager.stop()).not.toThrow();
      expect(() => manager.stop()).not.toThrow(); // Idempotent
    });
  });
});
