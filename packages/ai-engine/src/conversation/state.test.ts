/**
 * Unit tests for Conversation State Management module.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import type { ParsedIntent } from '@minori/shared';
import {
  InMemoryStorage,
  ConversationManager,
  createConversationState,
  isConversationExpired,
  getMissingFields,
  mergeEntities,
  hasAllRequiredFields,
  addMessageToHistory,
  getConversationContext,
  transitionToCollecting,
  transitionToConfirming,
  transitionToCompleted,
  transitionToCancelled,
  transitionToIdle,
  getConversationState,
  updateConversationState,
  resetConversationState,
  CONVERSATION_TIMEOUT_MS,
  MAX_HISTORY_LENGTH,
  REQUIRED_FIELDS,
  type ConversationState,
} from './state';

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  test('stores and retrieves conversation state', async () => {
    const state = createConversationState('user1');
    await storage.set('user1', state);

    const retrieved = await storage.get('user1');
    expect(retrieved).toEqual(state);
  });

  test('returns null for non-existent user', async () => {
    const retrieved = await storage.get('nonexistent');
    expect(retrieved).toBeNull();
  });

  test('deletes conversation state', async () => {
    const state = createConversationState('user1');
    await storage.set('user1', state);
    await storage.delete('user1');

    const retrieved = await storage.get('user1');
    expect(retrieved).toBeNull();
  });

  test('deletes expired conversations', async () => {
    const oldState = createConversationState('old-user');
    oldState.lastInteractionAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    await storage.set('old-user', oldState);

    const newState = createConversationState('new-user');
    await storage.set('new-user', newState);

    const deleted = await storage.deleteExpired(5 * 60 * 1000); // 5 minute threshold
    expect(deleted).toBe(1);
    expect(await storage.get('old-user')).toBeNull();
    expect(await storage.get('new-user')).not.toBeNull();
  });

  test('reports correct size', async () => {
    expect(storage.size).toBe(0);

    await storage.set('user1', createConversationState('user1'));
    expect(storage.size).toBe(1);

    await storage.set('user2', createConversationState('user2'));
    expect(storage.size).toBe(2);
  });

  test('clears all conversations', async () => {
    await storage.set('user1', createConversationState('user1'));
    await storage.set('user2', createConversationState('user2'));

    storage.clear();
    expect(storage.size).toBe(0);
  });
});

describe('createConversationState', () => {
  test('creates state with correct defaults', () => {
    const state = createConversationState('user123');

    expect(state.userId).toBe('user123');
    expect(state.phase).toBe('idle');
    expect(state.currentIntent).toBeUndefined();
    expect(state.collectedEntities).toEqual({});
    expect(state.missingFields).toEqual([]);
    expect(state.history).toEqual([]);
    expect(state.lastInteractionAt).toBeInstanceOf(Date);
    expect(state.createdAt).toBeInstanceOf(Date);
  });
});

describe('isConversationExpired', () => {
  test('returns false for fresh conversation', () => {
    const state = createConversationState('user1');
    expect(isConversationExpired(state)).toBe(false);
  });

  test('returns true for expired conversation', () => {
    const state = createConversationState('user1');
    state.lastInteractionAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    expect(isConversationExpired(state)).toBe(true);
  });

  test('uses custom timeout', () => {
    const state = createConversationState('user1');
    state.lastInteractionAt = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago

    expect(isConversationExpired(state, 1 * 60 * 1000)).toBe(true); // 1 minute threshold
    expect(isConversationExpired(state, 5 * 60 * 1000)).toBe(false); // 5 minute threshold
  });
});

describe('getMissingFields', () => {
  test('returns empty array for intent without required fields', () => {
    expect(getMissingFields('query_crops', {})).toEqual([]);
    expect(getMissingFields('help', {})).toEqual([]);
    expect(getMissingFields('unknown', {})).toEqual([]);
  });

  test('returns all required fields when none provided', () => {
    expect(getMissingFields('record_planting', {})).toEqual(['crop', 'area']);
    expect(getMissingFields('record_harvest', {})).toEqual(['crop', 'quantity']);
    expect(getMissingFields('record_growth', {})).toEqual(['crop']);
  });

  test('returns remaining missing fields', () => {
    expect(getMissingFields('record_planting', { crop: '小白菜' })).toEqual(['area']);
    expect(getMissingFields('record_planting', { area: 2 })).toEqual(['crop']);
    expect(getMissingFields('record_harvest', { crop: '空心菜' })).toEqual(['quantity']);
  });

  test('returns empty array when all fields provided', () => {
    expect(getMissingFields('record_planting', { crop: '小白菜', area: 2 })).toEqual([]);
    expect(getMissingFields('record_harvest', { crop: '空心菜', quantity: 50 })).toEqual([]);
    expect(getMissingFields('record_growth', { crop: '番茄' })).toEqual([]);
  });
});

describe('mergeEntities', () => {
  test('merges empty objects', () => {
    expect(mergeEntities({}, {})).toEqual({});
  });

  test('merges non-overlapping entities', () => {
    const result = mergeEntities({ crop: '小白菜' }, { area: 2 });
    expect(result).toEqual({ crop: '小白菜', area: 2 });
  });

  test('incoming values override existing', () => {
    const result = mergeEntities({ crop: '小白菜', area: 1 }, { area: 2 });
    expect(result).toEqual({ crop: '小白菜', area: 2 });
  });

  test('ignores undefined values in incoming', () => {
    const result = mergeEntities({ crop: '小白菜', area: 2 }, { crop: undefined, quantity: 50 });
    expect(result).toEqual({ crop: '小白菜', area: 2, quantity: 50 });
  });
});

describe('hasAllRequiredFields', () => {
  test('returns true for complete planting intent', () => {
    expect(hasAllRequiredFields('record_planting', { crop: '小白菜', area: 2 })).toBe(true);
  });

  test('returns false for incomplete planting intent', () => {
    expect(hasAllRequiredFields('record_planting', { crop: '小白菜' })).toBe(false);
    expect(hasAllRequiredFields('record_planting', { area: 2 })).toBe(false);
  });

  test('returns true for intents without required fields', () => {
    expect(hasAllRequiredFields('query_crops', {})).toBe(true);
    expect(hasAllRequiredFields('help', {})).toBe(true);
  });
});

describe('addMessageToHistory', () => {
  test('adds message to empty history', () => {
    const state = createConversationState('user1');
    const history = addMessageToHistory(state, 'user', 'Hello');

    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe('user');
    expect(history[0]?.content).toBe('Hello');
    expect(history[0]?.timestamp).toBeInstanceOf(Date);
  });

  test('preserves existing messages', () => {
    const state = createConversationState('user1');
    state.history = [{ role: 'user', content: 'First', timestamp: new Date() }];

    const history = addMessageToHistory(state, 'assistant', 'Second');

    expect(history).toHaveLength(2);
    expect(history[0]?.content).toBe('First');
    expect(history[1]?.content).toBe('Second');
  });

  test('trims history to max length', () => {
    const state = createConversationState('user1');
    state.history = Array.from({ length: MAX_HISTORY_LENGTH }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
      timestamp: new Date(),
    }));

    const history = addMessageToHistory(state, 'user', 'New message');

    expect(history).toHaveLength(MAX_HISTORY_LENGTH);
    expect(history[history.length - 1]?.content).toBe('New message');
    expect(history[0]?.content).toBe('Message 1'); // First message removed
  });
});

describe('getConversationContext', () => {
  test('returns empty string for empty history', () => {
    const state = createConversationState('user1');
    expect(getConversationContext(state)).toBe('');
  });

  test('formats conversation context', () => {
    const state = createConversationState('user1');
    state.history = [
      { role: 'user', content: '種了小白菜', timestamp: new Date() },
      { role: 'assistant', content: '請問種了多少？', timestamp: new Date() },
    ];

    const context = getConversationContext(state);
    expect(context).toContain('用戶: 種了小白菜');
    expect(context).toContain('助理: 請問種了多少？');
  });

  test('limits to maxMessages', () => {
    const state = createConversationState('user1');
    state.history = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
      timestamp: new Date(),
    }));

    const context = getConversationContext(state, 3);
    expect(context.split('\n')).toHaveLength(3);
    expect(context).toContain('Message 9');
    expect(context).not.toContain('Message 0');
  });
});

describe('state transitions', () => {
  let baseState: ConversationState;

  beforeEach(() => {
    baseState = createConversationState('user1');
  });

  test('transitionToCollecting sets correct phase and fields', () => {
    const result = transitionToCollecting(baseState, 'record_planting', { crop: '小白菜' });

    expect(result.phase).toBe('collecting');
    expect(result.currentIntent).toBe('record_planting');
    expect(result.collectedEntities).toEqual({ crop: '小白菜' });
    expect(result.missingFields).toEqual(['area']);
  });

  test('transitionToConfirming clears missing fields', () => {
    baseState.missingFields = ['crop', 'area'];
    const result = transitionToConfirming(baseState);

    expect(result.phase).toBe('confirming');
    expect(result.missingFields).toEqual([]);
  });

  test('transitionToCompleted sets completed phase', () => {
    const result = transitionToCompleted(baseState);
    expect(result.phase).toBe('completed');
  });

  test('transitionToCancelled sets cancelled phase', () => {
    const result = transitionToCancelled(baseState);
    expect(result.phase).toBe('cancelled');
  });

  test('transitionToIdle resets conversation context', () => {
    baseState.phase = 'collecting';
    baseState.currentIntent = 'record_planting';
    baseState.collectedEntities = { crop: '小白菜' };
    baseState.missingFields = ['area'];
    baseState.history = [{ role: 'user', content: 'test', timestamp: new Date() }];

    const result = transitionToIdle(baseState);

    expect(result.phase).toBe('idle');
    expect(result.currentIntent).toBeUndefined();
    expect(result.collectedEntities).toEqual({});
    expect(result.missingFields).toEqual([]);
    expect(result.history).toHaveLength(1); // History preserved
  });
});

describe('getConversationState', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  test('creates new state for new user', async () => {
    const state = await getConversationState('new-user', storage);

    expect(state.userId).toBe('new-user');
    expect(state.phase).toBe('idle');
    expect(storage.size).toBe(1);
  });

  test('returns existing state', async () => {
    const initial = createConversationState('user1');
    initial.phase = 'collecting';
    await storage.set('user1', initial);

    const state = await getConversationState('user1', storage);
    expect(state.phase).toBe('collecting');
  });

  test('resets expired state', async () => {
    const expired = createConversationState('user1');
    expired.phase = 'collecting';
    expired.lastInteractionAt = new Date(Date.now() - 10 * 60 * 1000);
    await storage.set('user1', expired);

    const state = await getConversationState('user1', storage);
    expect(state.phase).toBe('idle'); // Reset to idle
  });
});

describe('updateConversationState', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  test('updates state fields', async () => {
    await getConversationState('user1', storage);

    const updated = await updateConversationState(
      'user1',
      { phase: 'collecting', currentIntent: 'record_planting' },
      storage
    );

    expect(updated.phase).toBe('collecting');
    expect(updated.currentIntent).toBe('record_planting');
  });

  test('updates lastInteractionAt', async () => {
    const initial = await getConversationState('user1', storage);
    const initialTime = initial.lastInteractionAt.getTime();

    // Small delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updated = await updateConversationState('user1', { phase: 'confirming' }, storage);

    expect(updated.lastInteractionAt.getTime()).toBeGreaterThan(initialTime);
  });
});

describe('resetConversationState', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  test('removes state from storage', async () => {
    await getConversationState('user1', storage);
    expect(storage.size).toBe(1);

    await resetConversationState('user1', storage);
    expect(storage.size).toBe(0);
  });
});

describe('ConversationManager', () => {
  let manager: ConversationManager;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    manager = new ConversationManager({ storage });
  });

  describe('processIntent - help', () => {
    test('returns help message', async () => {
      const intent: ParsedIntent = {
        action: 'help',
        entities: {},
        confidence: 0.9,
        rawText: '怎麼用',
      };

      const result = await manager.processIntent('user1', intent);

      expect(result.isComplete).toBe(false);
      expect(result.needsClarification).toBe(false);
      expect(result.response).toContain('記錄播種');
      expect(result.response).toContain('記錄採收');
    });
  });

  describe('processIntent - cancel', () => {
    test('cancels and resets conversation', async () => {
      // First, start a conversation
      const plantIntent: ParsedIntent = {
        action: 'record_planting',
        entities: { crop: '小白菜' },
        confidence: 0.8,
        rawText: '種了小白菜',
      };
      await manager.processIntent('user1', plantIntent);

      // Then cancel
      const cancelIntent: ParsedIntent = {
        action: 'cancel',
        entities: {},
        confidence: 0.9,
        rawText: '取消',
      };
      const result = await manager.processIntent('user1', cancelIntent);

      expect(result.isComplete).toBe(false);
      expect(result.response).toContain('取消');

      // State should be reset
      const state = await manager.getState('user1');
      expect(state.phase).toBe('idle');
    });
  });

  describe('processIntent - confirm', () => {
    test('completes conversation when in confirming phase', async () => {
      // Set up a state in confirming phase
      await updateConversationState(
        'user1',
        {
          phase: 'confirming',
          currentIntent: 'record_planting',
          collectedEntities: { crop: '小白菜', area: 2 },
        },
        storage
      );

      const confirmIntent: ParsedIntent = {
        action: 'confirm',
        entities: {},
        confidence: 0.9,
        rawText: '對',
      };
      const result = await manager.processIntent('user1', confirmIntent);

      expect(result.isComplete).toBe(true);
      expect(result.action).toBe('record_planting');
      expect(result.entities).toEqual({ crop: '小白菜', area: 2 });
    });

    test('returns message when not in confirming phase', async () => {
      const confirmIntent: ParsedIntent = {
        action: 'confirm',
        entities: {},
        confidence: 0.9,
        rawText: '對',
      };
      const result = await manager.processIntent('user1', confirmIntent);

      expect(result.isComplete).toBe(false);
      expect(result.response).toContain('沒有需要確認');
    });
  });

  describe('processIntent - collecting intent', () => {
    test('asks for missing fields', async () => {
      const intent: ParsedIntent = {
        action: 'record_planting',
        entities: { crop: '小白菜' }, // Missing area
        confidence: 0.8,
        rawText: '種了小白菜',
      };

      const result = await manager.processIntent('user1', intent);

      expect(result.needsClarification).toBe(true);
      expect(result.isComplete).toBe(false);
      expect(result.response).toContain('面積');
      expect(result.state.phase).toBe('collecting');
    });

    test('asks for confirmation when all fields present', async () => {
      const intent: ParsedIntent = {
        action: 'record_planting',
        entities: { crop: '小白菜', area: 2 },
        confidence: 0.9,
        rawText: '種了兩分地小白菜',
      };

      const result = await manager.processIntent('user1', intent);

      expect(result.needsClarification).toBe(false);
      expect(result.isComplete).toBe(false);
      expect(result.response).toContain('確認');
      expect(result.state.phase).toBe('confirming');
    });

    test('merges entities across multiple turns', async () => {
      // First turn: provide crop
      const intent1: ParsedIntent = {
        action: 'record_planting',
        entities: { crop: '小白菜' },
        confidence: 0.7,
        rawText: '種了小白菜',
      };
      await manager.processIntent('user1', intent1);

      // Second turn: provide area
      const intent2: ParsedIntent = {
        action: 'record_planting',
        entities: { area: 2 },
        confidence: 0.8,
        rawText: '兩分地',
      };
      const result = await manager.processIntent('user1', intent2);

      expect(result.state.collectedEntities).toEqual({ crop: '小白菜', area: 2 });
      expect(result.state.phase).toBe('confirming');
    });
  });

  describe('processIntent - simple intent', () => {
    test('completes immediately for query intents', async () => {
      const intent: ParsedIntent = {
        action: 'query_crops',
        entities: {},
        confidence: 0.9,
        rawText: '我種了什麼',
      };

      const result = await manager.processIntent('user1', intent);

      expect(result.isComplete).toBe(true);
      expect(result.action).toBe('query_crops');
      expect(result.needsClarification).toBe(false);
    });
  });

  describe('addEntities', () => {
    test('adds entities to current conversation', async () => {
      // Start a collecting conversation
      await updateConversationState(
        'user1',
        {
          phase: 'collecting',
          currentIntent: 'record_planting',
          collectedEntities: { crop: '小白菜' },
          missingFields: ['area'],
        },
        storage
      );

      const result = await manager.addEntities('user1', { area: 2 });

      expect(result.state.phase).toBe('confirming');
      expect(result.state.collectedEntities).toEqual({ crop: '小白菜', area: 2 });
    });

    test('returns message when not in collecting phase', async () => {
      const result = await manager.addEntities('user1', { area: 2 });

      expect(result.response).toContain('沒有進行中的對話');
    });
  });

  describe('history recording', () => {
    test('records user and assistant messages', async () => {
      await manager.recordUserMessage('user1', 'Hello');
      await manager.recordAssistantMessage('user1', 'Hi there');

      const state = await manager.getState('user1');
      expect(state.history).toHaveLength(2);
      expect(state.history[0]?.role).toBe('user');
      expect(state.history[1]?.role).toBe('assistant');
    });
  });

  describe('reset', () => {
    test('resets conversation state', async () => {
      await manager.processIntent('user1', {
        action: 'record_planting',
        entities: { crop: '小白菜' },
        confidence: 0.8,
        rawText: '種了小白菜',
      });

      await manager.reset('user1');

      const state = await manager.getState('user1');
      expect(state.phase).toBe('idle');
      expect(state.collectedEntities).toEqual({});
    });
  });
});

describe('constants', () => {
  test('CONVERSATION_TIMEOUT_MS is 5 minutes', () => {
    expect(CONVERSATION_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  test('MAX_HISTORY_LENGTH is 20', () => {
    expect(MAX_HISTORY_LENGTH).toBe(20);
  });

  test('REQUIRED_FIELDS has correct mappings', () => {
    expect(REQUIRED_FIELDS.record_planting).toEqual(['crop', 'area']);
    expect(REQUIRED_FIELDS.record_harvest).toEqual(['crop', 'quantity']);
    expect(REQUIRED_FIELDS.record_growth).toEqual(['crop']);
  });
});
