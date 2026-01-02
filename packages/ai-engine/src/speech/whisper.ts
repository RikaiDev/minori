/**
 * OpenAI Whisper Speech Recognition Integration
 *
 * Provides speech-to-text functionality using OpenAI's Whisper API.
 * Supports Mandarin Chinese and Taiwanese (Hokkien) by setting language to 'zh'.
 */

import OpenAI, { toFile } from 'openai';

const openai = new OpenAI();

export interface TranscribeOptions {
  /** Audio buffer (supports m4a, mp3, wav, etc.) */
  audioBuffer: Buffer;
  /** Language code: 'zh' for Chinese (includes Taiwanese), 'auto' for auto-detect */
  language?: 'zh' | 'auto';
  /** Custom prompt to improve recognition accuracy */
  prompt?: string;
}

export interface TranscribeResult {
  /** Transcribed text */
  text: string;
  /** Audio duration in seconds (if available) */
  duration?: number;
}

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
 * Transcribes audio to text using OpenAI Whisper API.
 *
 * @param options - Transcription options
 * @returns Transcription result with text
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
export async function transcribe(
  options: TranscribeOptions
): Promise<TranscribeResult> {
  const { audioBuffer, language = 'zh', prompt } = options;

  // Create a File object for the OpenAI API using their toFile utility
  const file = await toFile(audioBuffer, 'audio.m4a', { type: 'audio/m4a' });

  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: language === 'auto' ? undefined : language,
    prompt: prompt ?? AGRICULTURE_PROMPT,
  });

  return {
    text: response.text,
  };
}
