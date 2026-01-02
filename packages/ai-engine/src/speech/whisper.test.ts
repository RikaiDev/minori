/**
 * Unit tests for Whisper speech recognition module.
 */

import { describe, expect, test } from 'bun:test';
import { isValidAudioBuffer, TranscriptionError } from './whisper';

describe('isValidAudioBuffer', () => {
  test('returns false for empty buffer', () => {
    expect(isValidAudioBuffer(Buffer.alloc(0))).toBe(false);
  });

  test('returns false for buffer smaller than 12 bytes', () => {
    expect(isValidAudioBuffer(Buffer.alloc(10))).toBe(false);
  });

  test('returns false for invalid audio data', () => {
    const invalidBuffer = Buffer.from('not audio data here');
    expect(isValidAudioBuffer(invalidBuffer)).toBe(false);
  });

  test('returns true for MP3 with ID3 tag', () => {
    // ID3 tag signature: 0x49 0x44 0x33 (ID3)
    const mp3Buffer = Buffer.alloc(12);
    mp3Buffer[0] = 0x49; // I
    mp3Buffer[1] = 0x44; // D
    mp3Buffer[2] = 0x33; // 3
    expect(isValidAudioBuffer(mp3Buffer)).toBe(true);
  });

  test('returns true for MP3 frame sync', () => {
    // MP3 frame sync: 0xFF 0xFB (or 0xFF followed by 0xE0-0xFF)
    const mp3Buffer = Buffer.alloc(12);
    mp3Buffer[0] = 0xff;
    mp3Buffer[1] = 0xfb;
    expect(isValidAudioBuffer(mp3Buffer)).toBe(true);
  });

  test('returns true for M4A/AAC file', () => {
    // M4A: bytes 4-7 are "ftyp"
    const m4aBuffer = Buffer.alloc(12);
    m4aBuffer[4] = 0x66; // f
    m4aBuffer[5] = 0x74; // t
    m4aBuffer[6] = 0x79; // y
    m4aBuffer[7] = 0x70; // p
    expect(isValidAudioBuffer(m4aBuffer)).toBe(true);
  });

  test('returns true for WAV file', () => {
    // WAV: starts with "RIFF"
    const wavBuffer = Buffer.alloc(12);
    wavBuffer[0] = 0x52; // R
    wavBuffer[1] = 0x49; // I
    wavBuffer[2] = 0x46; // F
    wavBuffer[3] = 0x46; // F
    expect(isValidAudioBuffer(wavBuffer)).toBe(true);
  });

  test('returns true for OGG file', () => {
    // OGG: starts with "OggS"
    const oggBuffer = Buffer.alloc(12);
    oggBuffer[0] = 0x4f; // O
    oggBuffer[1] = 0x67; // g
    oggBuffer[2] = 0x67; // g
    oggBuffer[3] = 0x53; // S
    expect(isValidAudioBuffer(oggBuffer)).toBe(true);
  });
});

describe('TranscriptionError', () => {
  test('creates error with code and message', () => {
    const error = new TranscriptionError('Test error', 'API_ERROR');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('API_ERROR');
    expect(error.name).toBe('TranscriptionError');
  });

  test('includes originalError when provided', () => {
    const originalError = new Error('Original error');
    const error = new TranscriptionError('Wrapped error', 'UNKNOWN', originalError);
    expect(error.originalError).toBe(originalError);
  });

  test('supports all error codes', () => {
    const codes = ['INVALID_AUDIO', 'API_ERROR', 'RATE_LIMITED', 'TIMEOUT', 'UNKNOWN'] as const;
    for (const code of codes) {
      const error = new TranscriptionError('Test', code);
      expect(error.code).toBe(code);
    }
  });
});

// Note: Integration tests for transcribe() function would require mocking OpenAI API
// or using actual API calls with test audio files. Those tests should be in a
// separate integration test suite with proper API key handling.
