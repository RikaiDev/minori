/**
 * Memory Manager
 *
 * High-level memory management for conversation context and user preferences.
 * Handles both short-term (conversation) and long-term (persistent) memory.
 */

import type {
  MemoryEntry,
  UserPreferences,
  CropPattern,
  EntityMemory,
  FactMemory,
  InteractionPattern,
  UserMemoryProfile,
  MemoryQueryOptions,
} from './types';
import type { MemoryStorage } from './storage';
import { InMemoryMemoryStorage } from './storage';

/**
 * Short-term memory entry for conversation context.
 */
export interface ConversationMemory {
  /** Message content */
  content: string;
  /** Role (user or assistant) */
  role: 'user' | 'assistant';
  /** Timestamp */
  timestamp: Date;
  /** Extracted entities */
  entities?: Record<string, unknown>;
  /** Intent if parsed */
  intent?: string;
}

/**
 * Conversation context for a user session.
 */
export interface ConversationContext {
  /** User ID */
  userId: string;
  /** Conversation ID */
  conversationId: string;
  /** Messages in this conversation */
  messages: ConversationMemory[];
  /** Current state (for multi-turn flows) */
  state?: string;
  /** Pending action data */
  pendingData?: Record<string, unknown>;
  /** Started timestamp */
  startedAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Memory manager configuration.
 */
export interface MemoryManagerConfig {
  /** Maximum messages to keep in short-term memory */
  maxConversationMessages?: number;
  /** Conversation timeout in milliseconds */
  conversationTimeoutMs?: number;
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs?: number;
  /** Default memory expiration in milliseconds */
  defaultExpirationMs?: number;
}

const DEFAULT_CONFIG: Required<MemoryManagerConfig> = {
  maxConversationMessages: 20,
  conversationTimeoutMs: 30 * 60 * 1000, // 30 minutes
  cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  defaultExpirationMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Memory Manager class.
 * Manages both short-term (conversation) and long-term (persistent) memory.
 */
export class MemoryManager {
  private storage: MemoryStorage;
  private config: Required<MemoryManagerConfig>;
  private conversations: Map<string, ConversationContext> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(storage?: MemoryStorage, config?: MemoryManagerConfig) {
    this.storage = storage ?? new InMemoryMemoryStorage();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the memory manager (begins cleanup timer).
   */
  start(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop the memory manager.
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // ============================================
  // Short-term Memory (Conversation Context)
  // ============================================

  /**
   * Get or create a conversation context for a user.
   */
  getConversation(userId: string): ConversationContext {
    const existing = this.conversations.get(userId);

    if (existing) {
      // Check if conversation has timed out
      const timeSinceActivity = Date.now() - existing.lastActivityAt.getTime();
      if (timeSinceActivity < this.config.conversationTimeoutMs) {
        return existing;
      }
      // Conversation timed out, create new one
    }

    const now = new Date();
    const context: ConversationContext = {
      userId,
      conversationId: `conv_${userId}_${Date.now()}`,
      messages: [],
      startedAt: now,
      lastActivityAt: now,
    };

    this.conversations.set(userId, context);
    return context;
  }

  /**
   * Add a message to the conversation.
   */
  addMessage(
    userId: string,
    content: string,
    role: 'user' | 'assistant',
    options?: {
      entities?: Record<string, unknown>;
      intent?: string;
    }
  ): ConversationContext {
    const context = this.getConversation(userId);
    const now = new Date();

    const message: ConversationMemory = {
      content,
      role,
      timestamp: now,
      entities: options?.entities,
      intent: options?.intent,
    };

    context.messages.push(message);
    context.lastActivityAt = now;

    // Trim messages if exceeding limit
    if (context.messages.length > this.config.maxConversationMessages) {
      context.messages = context.messages.slice(-this.config.maxConversationMessages);
    }

    return context;
  }

  /**
   * Set conversation state for multi-turn flows.
   */
  setConversationState(
    userId: string,
    state: string | undefined,
    pendingData?: Record<string, unknown>
  ): void {
    const context = this.getConversation(userId);
    context.state = state;
    context.pendingData = pendingData;
    context.lastActivityAt = new Date();
  }

  /**
   * Get recent messages from conversation.
   */
  getRecentMessages(userId: string, count?: number): ConversationMemory[] {
    const context = this.conversations.get(userId);
    if (!context) return [];

    const messages = context.messages;
    if (count && messages.length > count) {
      return messages.slice(-count);
    }
    return messages;
  }

  /**
   * Clear conversation context for a user.
   */
  clearConversation(userId: string): void {
    this.conversations.delete(userId);
  }

  // ============================================
  // Long-term Memory (Persistent)
  // ============================================

  /**
   * Get user preferences.
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const memory = await this.storage.getByKey(userId, 'preferences');
    if (memory && memory.type === 'preference') {
      await this.storage.touch(memory.id);
      return memory.value as UserPreferences;
    }
    return {};
  }

  /**
   * Update user preferences.
   */
  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    const existing = await this.getPreferences(userId);
    const merged = { ...existing, ...preferences };

    await this.storage.upsert(userId, 'preferences', 'preference', merged, {
      confidence: 1.0,
      source: 'user_explicit',
    });
  }

  /**
   * Get crop patterns for a user.
   */
  async getCropPatterns(userId: string): Promise<CropPattern[]> {
    const memories = await this.storage.query(userId, {
      type: 'crop_pattern',
      sortBy: 'reinforceCount',
      sortOrder: 'desc',
    });

    return memories.map((m) => m.value as CropPattern);
  }

  /**
   * Update or create a crop pattern.
   */
  async updateCropPattern(userId: string, pattern: CropPattern): Promise<void> {
    const key = `crop_pattern:${pattern.cropId}`;
    const existing = await this.storage.getByKey(userId, key);

    if (existing) {
      // Merge with existing pattern
      const existingPattern = existing.value as CropPattern;
      const merged: CropPattern = {
        ...existingPattern,
        plantCount: existingPattern.plantCount + pattern.plantCount,
        harvestCount: existingPattern.harvestCount + pattern.harvestCount,
        avgAreaSize: pattern.avgAreaSize ?? existingPattern.avgAreaSize,
        avgHarvestQuantity: pattern.avgHarvestQuantity ?? existingPattern.avgHarvestQuantity,
        typicalSeasons: pattern.typicalSeasons ?? existingPattern.typicalSeasons,
        lastPlantedAt: pattern.lastPlantedAt ?? existingPattern.lastPlantedAt,
        lastHarvestedAt: pattern.lastHarvestedAt ?? existingPattern.lastHarvestedAt,
      };

      await this.storage.upsert(userId, key, 'crop_pattern', merged);
      await this.storage.reinforce(existing.id);
    } else {
      await this.storage.upsert(userId, key, 'crop_pattern', pattern, {
        confidence: 0.7,
        source: 'inferred',
      });
    }
  }

  /**
   * Store an entity memory.
   */
  async storeEntity(userId: string, entity: EntityMemory): Promise<void> {
    const key = `entity:${entity.entityType}:${entity.value}`;
    const existing = await this.storage.getByKey(userId, key);

    if (existing) {
      const existingEntity = existing.value as EntityMemory;
      const merged: EntityMemory = {
        ...existingEntity,
        frequency: existingEntity.frequency + 1,
        context: entity.context ?? existingEntity.context,
        normalizedValue: entity.normalizedValue ?? existingEntity.normalizedValue,
      };
      await this.storage.upsert(userId, key, 'entity', merged);
      await this.storage.reinforce(existing.id);
    } else {
      await this.storage.upsert(userId, key, 'entity', entity, {
        confidence: 0.5,
        source: 'extracted',
      });
    }
  }

  /**
   * Get entity memories.
   */
  async getEntities(userId: string, entityType?: string): Promise<EntityMemory[]> {
    const keyPattern = entityType ? `entity:${entityType}:` : 'entity:';
    const memories = await this.storage.query(userId, {
      type: 'entity',
      keyPattern,
      sortBy: 'reinforceCount',
      sortOrder: 'desc',
    });

    return memories.map((m) => m.value as EntityMemory);
  }

  /**
   * Store a fact.
   */
  async storeFact(userId: string, fact: FactMemory): Promise<void> {
    const key = `fact:${fact.subject}:${fact.predicate}`;

    await this.storage.upsert(userId, key, 'fact', fact, {
      confidence: fact.permanent ? 1.0 : 0.7,
      source: 'inferred',
      expiresAt: fact.permanent
        ? undefined
        : new Date(Date.now() + this.config.defaultExpirationMs),
    });
  }

  /**
   * Get facts about a user.
   */
  async getFacts(userId: string, subject?: string): Promise<FactMemory[]> {
    const keyPattern = subject ? `fact:${subject}:` : 'fact:';
    const memories = await this.storage.query(userId, {
      type: 'fact',
      keyPattern,
    });

    return memories.map((m) => m.value as FactMemory);
  }

  /**
   * Store an interaction pattern.
   */
  async storeInteractionPattern(userId: string, pattern: InteractionPattern): Promise<void> {
    const key = `pattern:${pattern.patternType}:${pattern.description}`;

    await this.storage.upsert(userId, key, 'interaction', pattern, {
      confidence: pattern.confidence,
      source: 'analyzed',
    });
  }

  /**
   * Get interaction patterns.
   */
  async getInteractionPatterns(userId: string): Promise<InteractionPattern[]> {
    const memories = await this.storage.query(userId, {
      type: 'interaction',
      sortBy: 'confidence',
      sortOrder: 'desc',
    });

    return memories.map((m) => m.value as InteractionPattern);
  }

  // ============================================
  // User Profile
  // ============================================

  /**
   * Get complete user memory profile.
   */
  async getUserProfile(userId: string): Promise<UserMemoryProfile> {
    const [preferences, cropPatterns, facts, interactionPatterns, totalMemories] =
      await Promise.all([
        this.getPreferences(userId),
        this.getCropPatterns(userId),
        this.getFacts(userId),
        this.getInteractionPatterns(userId),
        this.storage.count(userId),
      ]);

    return {
      userId,
      preferences,
      cropPatterns,
      facts,
      interactionPatterns,
      totalMemories,
      lastUpdatedAt: new Date(),
    };
  }

  /**
   * Build context string for AI prompts.
   */
  async buildContextForAI(userId: string): Promise<string> {
    const profile = await this.getUserProfile(userId);
    const conversation = this.conversations.get(userId);

    const parts: string[] = [];

    // User preferences
    if (Object.keys(profile.preferences).length > 0) {
      parts.push(`User preferences: ${JSON.stringify(profile.preferences)}`);
    }

    // Common crops
    if (profile.cropPatterns.length > 0) {
      const topCrops = profile.cropPatterns
        .slice(0, 5)
        .map((p) => p.cropName)
        .join(', ');
      parts.push(`Common crops: ${topCrops}`);
    }

    // Recent facts
    if (profile.facts.length > 0) {
      const factStrings = profile.facts
        .slice(0, 5)
        .map((f) => `${f.subject} ${f.predicate} ${f.object}`);
      parts.push(`Known facts: ${factStrings.join('; ')}`);
    }

    // Conversation state
    if (conversation?.state) {
      parts.push(`Current conversation state: ${conversation.state}`);
    }

    if (conversation?.pendingData) {
      parts.push(`Pending data: ${JSON.stringify(conversation.pendingData)}`);
    }

    return parts.join('\n');
  }

  // ============================================
  // Cleanup and Maintenance
  // ============================================

  /**
   * Clean up expired conversations and memories.
   */
  async cleanup(): Promise<{ conversationsCleared: number; memoriesDeleted: number }> {
    const now = Date.now();
    let conversationsCleared = 0;

    // Clean up expired conversations
    for (const [userId, context] of this.conversations) {
      const timeSinceActivity = now - context.lastActivityAt.getTime();
      if (timeSinceActivity > this.config.conversationTimeoutMs) {
        this.conversations.delete(userId);
        conversationsCleared++;
      }
    }

    // Clean up expired memories
    const memoriesDeleted = await this.storage.cleanupExpired();

    return { conversationsCleared, memoriesDeleted };
  }

  /**
   * Delete all memory for a user.
   */
  async deleteUserMemory(userId: string): Promise<void> {
    this.conversations.delete(userId);
    await this.storage.deleteAllForUser(userId);
  }

  /**
   * Query raw memories (for debugging/admin).
   */
  async queryMemories(userId: string, options?: MemoryQueryOptions): Promise<MemoryEntry[]> {
    return this.storage.query(userId, options);
  }
}
