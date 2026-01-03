/**
 * Unit tests for Image Handler.
 */

import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { webhook } from '@line/bot-sdk';

// Define mock function types - use 'any' for args to allow proper function signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof mock<T>> & {
  mockResolvedValueOnce: (value: Awaited<ReturnType<T>>) => void;
  mockRejectedValueOnce: (error: Error) => void;
  mockReturnValue: (value: ReturnType<T>) => void;
};

// Crop identification result type
interface CropIdentificationResult {
  identifiedName?: string;
  confidence: number;
  crop?: { id: string; name: string };
  growthStage?: string;
  healthStatus?: string;
  observations?: string;
  alternatives?: Array<{ name: string; confidence: number }>;
}

// Mock dependencies
const mockReplyText = mock(() => Promise.resolve()) as MockFn<
  (token: string, text: string) => Promise<void>
>;
const mockReplyWithQuickReply = mock(() => Promise.resolve()) as MockFn<
  (token: string, text: string, buttons: unknown[]) => Promise<void>
>;

const mockDownloadLineImage = mock(() => Promise.resolve(Buffer.from('image-data'))) as MockFn<
  (id: string, token: string) => Promise<Buffer>
>;
const mockIdentifyCrop = mock(() =>
  Promise.resolve({
    identifiedName: '小白菜',
    confidence: 0.92,
    crop: {
      id: 'bok-choy',
      name: '小白菜',
    },
    growthStage: 'vegetative',
    healthStatus: 'healthy',
    observations: 'Looks healthy with good leaf development.',
  } as CropIdentificationResult)
) as MockFn<(opts: unknown) => Promise<CropIdentificationResult>>;
const mockIsReliableIdentification = mock(() => true) as unknown as MockFn<
  (result: CropIdentificationResult) => boolean
>;
const mockIsUnrecognized = mock(() => false) as unknown as MockFn<
  (result: CropIdentificationResult) => boolean
>;

// Custom error class for testing
class MockCropIdentificationError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'CropIdentificationError';
  }
}

mock.module('../client', () => ({
  replyText: mockReplyText,
  replyWithQuickReply: mockReplyWithQuickReply,
  QuickReplyPresets: {
    mainMenu: () => [{ label: 'Menu', text: 'Menu' }],
    commonCrops: () => [{ label: '小白菜', text: '小白菜' }],
  },
}));

mock.module('@minori/ai-engine', () => ({
  downloadLineImage: mockDownloadLineImage,
  identifyCrop: mockIdentifyCrop,
  isReliableIdentification: mockIsReliableIdentification,
  isUnrecognized: mockIsUnrecognized,
  CropIdentificationError: MockCropIdentificationError,
}));

mock.module('@minori/shared', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
  formatDate: (date: Date) => date.toISOString().split('T')[0],
}));

mock.module('@minori/core', () => ({
  predictHarvest: () => ({
    predictions: {
      earliest: new Date('2025-01-20'),
      likely: new Date('2025-01-25'),
      latest: new Date('2025-01-30'),
    },
    confidence: 0.85,
  }),
}));

import { handleImageMessage } from './image-handler';

type ImageMessageContent = webhook.ImageMessageContent;
type MessageEvent = webhook.MessageEvent;

describe('handleImageMessage', () => {
  beforeEach(() => {
    mockReplyText.mockClear();
    mockReplyWithQuickReply.mockClear();
    mockDownloadLineImage.mockClear();
    mockIdentifyCrop.mockClear();
    mockIsReliableIdentification.mockReturnValue(true);
    mockIsUnrecognized.mockReturnValue(false);
  });

  test('ignores messages without user ID', async () => {
    const event = {
      source: {},
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'test-token');

    expect(mockDownloadLineImage).not.toHaveBeenCalled();
    expect(mockReplyText).not.toHaveBeenCalled();
  });

  test('downloads image using message ID', async () => {
    // Set environment variable for test
    const originalToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-access-token';

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-123', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'test-token');

    expect(mockDownloadLineImage).toHaveBeenCalledWith('image-123', 'test-access-token');

    process.env.LINE_CHANNEL_ACCESS_TOKEN = originalToken;
  });

  test('calls identifyCrop with downloaded image data', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockIdentifyCrop).toHaveBeenCalledWith({
      image: expect.any(Buffer),
      detectGrowthStage: true,
      detectHealth: true,
    });
  });

  test('handles unrecognized images', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIsUnrecognized.mockReturnValue(true);

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyText).toHaveBeenCalled();
    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.unrecognized');
  });

  test('handles low confidence identification', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIsUnrecognized.mockReturnValue(false);
    mockIsReliableIdentification.mockReturnValue(false);
    mockIdentifyCrop.mockResolvedValueOnce({
      identifiedName: '小白菜',
      confidence: 0.5,
      alternatives: [
        { name: '青江菜', confidence: 0.4 },
        { name: '芥蘭', confidence: 0.3 },
      ],
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyWithQuickReply).toHaveBeenCalled();
    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.lowConfidence');
  });

  test('shows alternatives for low confidence', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIsUnrecognized.mockReturnValue(false);
    mockIsReliableIdentification.mockReturnValue(false);
    mockIdentifyCrop.mockResolvedValueOnce({
      identifiedName: '小白菜',
      confidence: 0.5,
      alternatives: [
        { name: '青江菜', confidence: 0.4 },
        { name: '芥蘭', confidence: 0.3 },
      ],
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.alternatives');
    expect(response).toContain('青江菜');
  });

  test('responds with identification success for reliable result', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIsUnrecognized.mockReturnValue(false);
    mockIsReliableIdentification.mockReturnValue(true);

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyWithQuickReply).toHaveBeenCalled();
    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.identified');
  });

  test('includes growth stage in response', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.growthStage');
  });

  test('includes health status in response', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.healthStatus');
  });

  test('includes observations in response', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('Looks healthy');
  });

  test('includes harvest prediction when crop is in database', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.harvestPrediction');
  });

  test('suggests recording the planting', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    const calls = mockReplyWithQuickReply.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.recordSuggestion');
  });

  test('handles INVALID_IMAGE error', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIdentifyCrop.mockRejectedValueOnce(
      new MockCropIdentificationError('Invalid image', 'INVALID_IMAGE')
    );

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyText).toHaveBeenCalledWith('reply-token', 'photo.invalidImage');
  });

  test('handles RATE_LIMITED error', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIdentifyCrop.mockRejectedValueOnce(
      new MockCropIdentificationError('Rate limited', 'RATE_LIMITED')
    );

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyText).toHaveBeenCalledWith('reply-token', 'photo.rateLimited');
  });

  test('handles TIMEOUT error', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIdentifyCrop.mockRejectedValueOnce(new MockCropIdentificationError('Timeout', 'TIMEOUT'));

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyText).toHaveBeenCalledWith('reply-token', 'photo.timeout');
  });

  test('handles generic CropIdentificationError', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockIdentifyCrop.mockRejectedValueOnce(
      new MockCropIdentificationError('Unknown error', 'UNKNOWN')
    );

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyText).toHaveBeenCalledWith('reply-token', 'photo.error');
  });

  test('handles general errors gracefully', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
    mockDownloadLineImage.mockRejectedValueOnce(new Error('Network error'));

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    expect(mockReplyText).toHaveBeenCalled();
    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('photo.received');
    expect(response).toContain('photo.developing');
  });

  test('throws error when LINE_CHANNEL_ACCESS_TOKEN is not set', async () => {
    const originalToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'image-1', type: 'image' },
    } as unknown as MessageEvent & { message: ImageMessageContent };

    await handleImageMessage(event, 'reply-token');

    // Should handle error gracefully
    expect(mockReplyText).toHaveBeenCalled();

    process.env.LINE_CHANNEL_ACCESS_TOKEN = originalToken;
  });
});
