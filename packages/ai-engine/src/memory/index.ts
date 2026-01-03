/**
 * Memory System
 *
 * Exports for the memory system that persists conversation context
 * and user preferences for context-aware AI responses.
 */

// Types
export type {
  MemoryType,
  MemoryEntry,
  UserPreferences,
  CropPattern,
  EntityMemory,
  FactMemory,
  InteractionPattern,
  UserMemoryProfile,
  MemoryQueryOptions,
  MemoryUpdateResult,
} from './types';

// Storage
export type { MemoryStorage } from './storage';
export { InMemoryMemoryStorage } from './storage';

// Manager
export type { ConversationMemory, ConversationContext, MemoryManagerConfig } from './manager';
export { MemoryManager } from './manager';
