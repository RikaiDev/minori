/**
 * Unit tests for Message Handler.
 *
 * These tests focus on the event routing logic without mocking
 * the internal conversation flow which has its own tests.
 */

import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { webhook } from '@line/bot-sdk';

// Define mock function types - use 'any' for args to allow proper function signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof mock<T>> & {
  mockResolvedValueOnce: (value: Awaited<ReturnType<T>>) => void;
  mockRejectedValueOnce: (error: Error) => void;
};

// Mock the reply functions
const mockReplyText = mock(() => Promise.resolve()) as MockFn<
  (token: string, text: string) => Promise<void>
>;
const mockReplyWithQuickReply = mock(() => Promise.resolve()) as MockFn<
  (token: string, text: string, buttons: unknown[]) => Promise<void>
>;

mock.module('../client', () => ({
  replyText: mockReplyText,
  replyWithQuickReply: mockReplyWithQuickReply,
  QuickReplyPresets: {
    mainMenu: () => [{ label: 'Menu', text: 'Menu' }],
    confirm: () => [
      { label: '確認', text: '確認' },
      { label: '取消', text: '取消' },
    ],
    helpCancel: () => [
      { label: '說明', text: '說明' },
      { label: '取消', text: '取消' },
    ],
    commonCrops: () => [{ label: '小白菜', text: '小白菜' }],
    areaUnits: () => [{ label: '1分地', text: '1分地' }],
    afterPlanting: () => [{ label: '查看預測', text: '查看預測' }],
    afterHarvest: () => [{ label: '查詢價格', text: '查詢價格' }],
  },
}));

// Mock AI engine with consistent behavior
mock.module('@minori/ai-engine', () => ({
  parseIntent: () =>
    Promise.resolve({
      action: 'help',
      confidence: 0.9,
      entities: {},
    }),
  ConversationManager: class {
    recordUserMessage = () => Promise.resolve();
    recordAssistantMessage = () => Promise.resolve();
    processIntent = () =>
      Promise.resolve({
        response: 'Help message',
        isComplete: false,
        needsClarification: false,
        state: { phase: 'idle' as const, missingFields: [] },
      });
  },
}));

mock.module('@minori/shared', () => ({
  t: (key: string) => key,
  formatDate: (date: Date) => date.toISOString().split('T')[0],
}));

mock.module('@minori/core', () => ({
  findCropByName: () => ({
    id: 'bok-choy',
    name: '小白菜',
    growth: { temperatureOptimal: '20-25°C' },
  }),
  predictHarvest: () => ({
    predictions: {
      earliest: new Date('2025-01-20'),
      likely: new Date('2025-01-25'),
      latest: new Date('2025-01-30'),
    },
    confidence: 0.85,
  }),
  getCropById: () => null,
  PriceService: class {
    getCropPriceStats = () =>
      Promise.resolve({
        currentPrice: 35,
        weeklyChange: 2.5,
        priceLow: 30,
        priceHigh: 40,
        trend: 'up' as const,
      });
  },
}));

mock.module('../services/field-record-service', () => ({
  getFieldRecordService: () => ({
    createPlantingRecord: () =>
      Promise.resolve({
        id: 'record-1',
        expectedHarvestDate: new Date('2025-01-25'),
      }),
    createHarvestRecord: () =>
      Promise.resolve({
        id: 'harvest-1',
      }),
    createGrowthRecord: () =>
      Promise.resolve({
        id: 'growth-1',
        plantingRecordId: 'record-1',
      }),
    getActivePlantingRecords: () =>
      Promise.resolve([
        {
          id: 'record-1',
          cropId: 'bok-choy',
          cropName: '小白菜',
          area: 2,
          plantedAt: new Date('2025-01-01'),
          expectedHarvestDate: new Date('2025-01-25'),
        },
      ]),
  }),
}));

// Note: cooperative-handler is not mocked to avoid interference with its own tests
// The actual handler is used which may require database connection in some cases

// Import after mocking
import { handleWebhookEvent, getConversationManager } from './message-handler';

describe('handleWebhookEvent - Event Routing', () => {
  beforeEach(() => {
    mockReplyText.mockClear();
    mockReplyWithQuickReply.mockClear();
  });

  test('ignores non-message events', async () => {
    const event = {
      type: 'follow',
      replyToken: 'test-token',
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    expect(mockReplyText).not.toHaveBeenCalled();
    expect(mockReplyWithQuickReply).not.toHaveBeenCalled();
  });

  test('ignores postback events', async () => {
    const event = {
      type: 'postback',
      replyToken: 'test-token',
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    expect(mockReplyText).not.toHaveBeenCalled();
    expect(mockReplyWithQuickReply).not.toHaveBeenCalled();
  });

  test('ignores events without reply token', async () => {
    const event = {
      type: 'message',
      message: { type: 'text', text: 'hello' },
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    expect(mockReplyText).not.toHaveBeenCalled();
    expect(mockReplyWithQuickReply).not.toHaveBeenCalled();
  });

  test('handles unsupported message types with error message', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'sticker' },
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    expect(mockReplyText).toHaveBeenCalledWith('test-token', 'error.unsupportedMessage');
  });

  test('handles location message type as unsupported', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'location' },
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    expect(mockReplyText).toHaveBeenCalledWith('test-token', 'error.unsupportedMessage');
  });

  test('does not reply for audio messages (handled by audio-handler)', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'audio', id: 'audio-1' },
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    // Audio handler is separate module, message handler doesn't reply
    expect(mockReplyText).not.toHaveBeenCalled();
    expect(mockReplyWithQuickReply).not.toHaveBeenCalled();
  });

  test('does not reply for image messages (handled by image-handler)', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'image', id: 'image-1' },
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    // Image handler is separate module, message handler doesn't reply
    expect(mockReplyText).not.toHaveBeenCalled();
    expect(mockReplyWithQuickReply).not.toHaveBeenCalled();
  });
});

describe('handleWebhookEvent - Text Message Processing', () => {
  beforeEach(() => {
    mockReplyText.mockClear();
    mockReplyWithQuickReply.mockClear();
  });

  test('processes text messages and replies', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'text', text: '幫助', id: 'msg-1' },
      source: { userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    // Should reply with either text or quick reply
    const replied =
      mockReplyText.mock.calls.length > 0 || mockReplyWithQuickReply.mock.calls.length > 0;
    expect(replied).toBe(true);
  });

  test('ignores text messages without user ID', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'text', text: '幫助', id: 'msg-1' },
      source: {}, // No userId
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    expect(mockReplyText).not.toHaveBeenCalled();
    expect(mockReplyWithQuickReply).not.toHaveBeenCalled();
  });

  test('ignores text messages from group without user ID', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'text', text: '幫助', id: 'msg-1' },
      source: { type: 'group', groupId: 'group-1' }, // Group without userId
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    expect(mockReplyText).not.toHaveBeenCalled();
    expect(mockReplyWithQuickReply).not.toHaveBeenCalled();
  });

  test('processes text messages from group with user ID', async () => {
    const event = {
      type: 'message',
      replyToken: 'test-token',
      message: { type: 'text', text: '幫助', id: 'msg-1' },
      source: { type: 'group', groupId: 'group-1', userId: 'user-1' },
    } as unknown as webhook.Event;

    await handleWebhookEvent(event);

    const replied =
      mockReplyText.mock.calls.length > 0 || mockReplyWithQuickReply.mock.calls.length > 0;
    expect(replied).toBe(true);
  });
});

describe('getConversationManager', () => {
  test('returns conversation manager instance', () => {
    const manager = getConversationManager();
    expect(manager).toBeDefined();
  });

  test('returns same instance on multiple calls (singleton)', () => {
    const manager1 = getConversationManager();
    const manager2 = getConversationManager();
    expect(manager1).toBe(manager2);
  });
});
