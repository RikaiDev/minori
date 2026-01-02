/**
 * OpenAI Whisper Speech Recognition Integration
 *
 * Provides speech-to-text functionality using OpenAI's Whisper API.
 * Supports Mandarin Chinese and Taiwanese (Hokkien) by setting language to 'zh'.
 */

import OpenAI, { toFile } from 'openai';

let openaiClient: OpenAI | null = null;

/**
 * Gets or creates the OpenAI client instance.
 * Uses lazy initialization to avoid errors when API key is not set during testing.
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

/** Default configuration for retry behavior */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 10000;

export interface TranscribeOptions {
  /** Audio buffer (supports m4a, mp3, wav, etc.) */
  audioBuffer: Buffer;
  /** Language code: 'zh' for Chinese (includes Taiwanese), 'auto' for auto-detect */
  language?: 'zh' | 'auto';
  /** Custom prompt to improve recognition accuracy */
  prompt?: string;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
}

export interface TranscribeResult {
  /** Transcribed text */
  text: string;
  /** Audio duration in seconds (if available) */
  duration?: number;
  /** Number of retry attempts made */
  retryCount?: number;
}

/**
 * Custom error class for transcription failures.
 */
export class TranscriptionError extends Error {
  public readonly code: TranscriptionErrorCode;
  public readonly originalError?: Error;

  constructor(message: string, code: TranscriptionErrorCode, originalError?: Error) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
    this.originalError = originalError;
  }
}

export type TranscriptionErrorCode =
  | 'INVALID_AUDIO'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Agriculture-related vocabulary prompt to improve recognition accuracy.
 * Includes common crop names, units, and action words in Traditional Chinese.
 */
const AGRICULTURE_PROMPT = `
農業、種植、播種、採收、施肥、除草、灌溉、
小白菜、空心菜、高麗菜、番茄、小黃瓜、絲瓜、苦瓜、
白蘿蔔、紅蘿蔔、菠菜、A菜、青江菜、
分地、甲、公頃、公斤、斤、台斤、
今天、昨天、前天、這禮拜、上禮拜、
種了、收了、長得、有蟲、要賣
`.trim();

/**
 * Delays execution for a specified number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates delay for exponential backoff with jitter.
 */
function calculateBackoff(attempt: number, initialDelay: number, maxDelay: number): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Determines if an error is retryable.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // Retry on rate limits (429) and server errors (5xx)
    return error.status === 429 || (error.status !== undefined && error.status >= 500);
  }
  // Retry on network errors
  if (error instanceof Error && error.message.includes('fetch')) {
    return true;
  }
  return false;
}

/**
 * Maps OpenAI errors to TranscriptionErrorCode.
 */
function mapErrorCode(error: unknown): TranscriptionErrorCode {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return 'RATE_LIMITED';
    if (error.status === 400) return 'INVALID_AUDIO';
    if (error.status !== undefined && error.status >= 500) return 'API_ERROR';
  }
  if (error instanceof Error && error.message.includes('timeout')) {
    return 'TIMEOUT';
  }
  return 'UNKNOWN';
}

/**
 * Transcribes audio to text using OpenAI Whisper API.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Agriculture-specific vocabulary prompt
 * - Support for Chinese and Taiwanese dialects
 *
 * @param options - Transcription options
 * @returns Transcription result with text
 * @throws {TranscriptionError} When transcription fails after all retries
 *
 * @example
 * ```typescript
 * const result = await transcribe({
 *   audioBuffer: audioData,
 *   language: 'zh',
 * });
 * console.log(result.text); // "今天種了兩分地的小白菜"
 * ```
 */
export async function transcribe(options: TranscribeOptions): Promise<TranscribeResult> {
  const { audioBuffer, language = 'zh', prompt, maxRetries = DEFAULT_MAX_RETRIES } = options;

  // Validate audio buffer
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new TranscriptionError('Audio buffer is empty or invalid', 'INVALID_AUDIO');
  }

  let lastError: Error | undefined;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a File object for the OpenAI API using their toFile utility
      const file = await toFile(audioBuffer, 'audio.m4a', { type: 'audio/m4a' });

      const response = await getOpenAIClient().audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: language === 'auto' ? undefined : language,
        prompt: prompt ?? AGRICULTURE_PROMPT,
      });

      return {
        text: response.text,
        retryCount,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount = attempt;

      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(error)) {
        const backoffMs = calculateBackoff(attempt, DEFAULT_INITIAL_DELAY_MS, DEFAULT_MAX_DELAY_MS);
        console.warn(
          `Transcription attempt ${attempt + 1} failed, retrying in ${Math.round(backoffMs)}ms:`,
          lastError.message
        );
        await delay(backoffMs);
        continue;
      }

      // No more retries, throw error
      break;
    }
  }

  // All retries exhausted
  const errorCode = mapErrorCode(lastError);
  throw new TranscriptionError(
    `Transcription failed after ${retryCount + 1} attempts: ${lastError?.message}`,
    errorCode,
    lastError
  );
}

/**
 * Validates that an audio buffer is in a supported format.
 * This is a quick check before sending to the API.
 *
 * @param buffer - Audio buffer to validate
 * @returns true if the buffer appears to be valid audio
 */
export function isValidAudioBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  // Check for common audio file signatures
  // We know indices 0-11 exist since we checked buffer.length >= 12 above
  const b0 = buffer[0]!;
  const b1 = buffer[1]!;
  const b2 = buffer[2]!;
  const b3 = buffer[3]!;
  const b4 = buffer[4]!;
  const b5 = buffer[5]!;
  const b6 = buffer[6]!;
  const b7 = buffer[7]!;

  // MP3: starts with ID3 or 0xFF 0xFB
  if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) {
    return true; // ID3 tag
  }
  if (b0 === 0xff && (b1 & 0xe0) === 0xe0) {
    return true; // MP3 frame sync
  }

  // M4A/AAC: starts with ftyp
  if (b4 === 0x66 && b5 === 0x74 && b6 === 0x79 && b7 === 0x70) {
    return true;
  }

  // WAV: starts with RIFF
  if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) {
    return true;
  }

  // OGG: starts with OggS
  if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) {
    return true;
  }

  return false;
}
