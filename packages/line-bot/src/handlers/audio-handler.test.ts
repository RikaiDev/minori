/**
 * Unit tests for Audio Handler.
 */

import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { webhook } from '@line/bot-sdk';

// Define mock function types - use 'any' for args to allow proper function signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof mock<T>> & {
  mockResolvedValueOnce: (value: Awaited<ReturnType<T>>) => void;
  mockRejectedValueOnce: (error: Error) => void;
};

// Mock dependencies
const mockReplyText = mock(() => Promise.resolve()) as MockFn<
  (token: string, text: string) => Promise<void>
>;
const mockGetMessageContent = mock(() => Promise.resolve(Buffer.from('audio-data'))) as MockFn<
  (id: string) => Promise<Buffer>
>;
const mockTranscribe = mock(() =>
  Promise.resolve({
    text: '種了小白菜2分地',
    confidence: 0.95,
  })
) as MockFn<
  (opts: { audioBuffer: Buffer; language: string }) => Promise<{ text: string; confidence: number }>
>;
const mockParseIntent = mock(() =>
  Promise.resolve({
    action: 'record_planting' as const,
    confidence: 0.9,
    entities: {
      crop: '小白菜',
      area: 2,
      areaUnit: '分地',
    },
  })
) as unknown as MockFn<
  (
    text: string
  ) => Promise<{ action: string; confidence: number; entities: Record<string, unknown> }>
>;

mock.module('../client', () => ({
  replyText: mockReplyText,
  getMessageContent: mockGetMessageContent,
}));

mock.module('@minori/ai-engine', () => ({
  transcribe: mockTranscribe,
  parseIntent: mockParseIntent,
}));

mock.module('@minori/shared', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (params) {
      let result = key;
      for (const [k, v] of Object.entries(params)) {
        result += `:${k}=${v}`;
      }
      return result;
    }
    return key;
  },
}));

import { handleAudioMessage } from './audio-handler';

type AudioMessageContent = webhook.AudioMessageContent;
type MessageEvent = webhook.MessageEvent;

describe('handleAudioMessage', () => {
  beforeEach(() => {
    mockReplyText.mockClear();
    mockGetMessageContent.mockClear();
    mockTranscribe.mockClear();
    mockParseIntent.mockClear();
  });

  test('ignores messages without user ID', async () => {
    const event = {
      source: {},
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockGetMessageContent).not.toHaveBeenCalled();
    expect(mockReplyText).not.toHaveBeenCalled();
  });

  test('downloads audio content using message ID', async () => {
    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-123', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockGetMessageContent).toHaveBeenCalledWith('audio-123');
  });

  test('transcribes audio with Chinese language setting', async () => {
    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockTranscribe).toHaveBeenCalledWith({
      audioBuffer: expect.any(Buffer),
      language: 'zh',
    });
  });

  test('handles empty transcription result', async () => {
    mockTranscribe.mockResolvedValueOnce({
      text: '   ',
      confidence: 0.5,
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockReplyText).toHaveBeenCalledWith('test-token', 'voice.notClear');
    expect(mockParseIntent).not.toHaveBeenCalled();
  });

  test('parses intent from transcribed text', async () => {
    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockParseIntent).toHaveBeenCalledWith('種了小白菜2分地');
  });

  test('responds with planting success for complete planting intent', async () => {
    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockReplyText).toHaveBeenCalled();
    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('voice.recognized');
    expect(response).toContain('record.planting.success');
  });

  test('asks for area when only crop is provided', async () => {
    mockParseIntent.mockResolvedValueOnce({
      action: 'record_planting',
      confidence: 0.9,
      entities: {
        crop: '小白菜',
      },
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('record.planting.askArea');
  });

  test('asks for crop when no entities provided for planting', async () => {
    mockParseIntent.mockResolvedValueOnce({
      action: 'record_planting',
      confidence: 0.9,
      entities: {},
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('record.planting.askCrop');
  });

  test('handles harvest intent with complete entities', async () => {
    mockParseIntent.mockResolvedValueOnce({
      action: 'record_harvest',
      confidence: 0.9,
      entities: {
        crop: '小白菜',
        quantity: 50,
        quantityUnit: '公斤',
      },
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('record.harvest.success');
  });

  test('asks for quantity when only crop provided for harvest', async () => {
    mockParseIntent.mockResolvedValueOnce({
      action: 'record_harvest',
      confidence: 0.9,
      entities: {
        crop: '小白菜',
      },
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('record.harvest.askQuantity');
  });

  test('handles unknown intent', async () => {
    mockParseIntent.mockResolvedValueOnce({
      action: 'unknown',
      confidence: 0.3,
      entities: {},
    });

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    const calls = mockReplyText.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const response = calls[0]?.[1] ?? '';
    expect(response).toContain('intent.unknown');
  });

  test('handles transcription error gracefully', async () => {
    mockTranscribe.mockRejectedValueOnce(new Error('Transcription failed'));

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockReplyText).toHaveBeenCalledWith('test-token', 'voice.error');
  });

  test('handles download error gracefully', async () => {
    mockGetMessageContent.mockRejectedValueOnce(new Error('Download failed'));

    const event = {
      source: { userId: 'user-1' },
      message: { id: 'audio-1', type: 'audio', duration: 1000 },
    } as unknown as MessageEvent & { message: AudioMessageContent };

    await handleAudioMessage(event, 'test-token');

    expect(mockReplyText).toHaveBeenCalledWith('test-token', 'voice.error');
  });
});
