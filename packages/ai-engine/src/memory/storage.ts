/**
 * Memory Storage Interface and Implementations
 *
 * Defines storage abstraction for the memory system.
 * Includes in-memory implementation for development and testing.
 */

import type { MemoryEntry, MemoryQueryOptions, MemoryUpdateResult, MemoryType } from './types';

/**
 * Generate a unique ID for memory entries.
 * Uses a simple nanoid-like approach.
 */
function createMemoryId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = 21;
  let id = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    id += chars[randomValues[i]! % chars.length];
  }
  return id;
}

/**
 * Memory storage interface.
 * Abstracts the underlying storage mechanism for memories.
 */
export interface MemoryStorage {
  /**
   * Get a memory entry by ID.
   */
  get(id: string): Promise<MemoryEntry | null>;

  /**
   * Get a memory entry by user ID and key.
   */
  getByKey(userId: string, key: string): Promise<MemoryEntry | null>;

  /**
   * Query memories for a user.
   */
  query(userId: string, options?: MemoryQueryOptions): Promise<MemoryEntry[]>;

  /**
   * Create or update a memory entry.
   * If a memory with the same userId and key exists, it updates.
   * Otherwise, it creates a new entry.
   */
  upsert(
    userId: string,
    key: string,
    type: MemoryType,
    value: unknown,
    options?: {
      confidence?: number;
      source?: string;
      metadata?: Record<string, unknown>;
      expiresAt?: Date;
    }
  ): Promise<MemoryUpdateResult>;

  /**
   * Delete a memory entry by ID.
   */
  delete(id: string): Promise<boolean>;

  /**
   * Delete all memories for a user.
   */
  deleteAllForUser(userId: string): Promise<number>;

  /**
   * Reinforce a memory (increase confidence and count).
   */
  reinforce(id: string): Promise<MemoryEntry | null>;

  /**
   * Update last accessed timestamp.
   */
  touch(id: string): Promise<void>;

  /**
   * Clean up expired memories.
   */
  cleanupExpired(): Promise<number>;

  /**
   * Get total memory count for a user.
   */
  count(userId: string): Promise<number>;
}

/**
 * In-memory storage implementation for the memory system.
 * Useful for development, testing, and short-lived sessions.
 */
export class InMemoryMemoryStorage implements MemoryStorage {
  private memories: Map<string, MemoryEntry> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();
  private keyIndex: Map<string, string> = new Map();

  private getUserKeyIndex(userId: string, key: string): string {
    return `${userId}:${key}`;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    return this.memories.get(id) || null;
  }

  async getByKey(userId: string, key: string): Promise<MemoryEntry | null> {
    const indexKey = this.getUserKeyIndex(userId, key);
    const id = this.keyIndex.get(indexKey);
    if (!id) return null;
    return this.memories.get(id) || null;
  }

  async query(userId: string, options: MemoryQueryOptions = {}): Promise<MemoryEntry[]> {
    const userMemoryIds = this.userIndex.get(userId);
    if (!userMemoryIds) return [];

    let results: MemoryEntry[] = [];

    for (const id of userMemoryIds) {
      const memory = this.memories.get(id);
      if (!memory) continue;

      // Check expiration
      if (!options.includeExpired && memory.expiresAt) {
        if (new Date() > memory.expiresAt) continue;
      }

      // Filter by type
      if (options.type && memory.type !== options.type) continue;

      // Filter by key pattern
      if (options.keyPattern) {
        const pattern = new RegExp(options.keyPattern);
        if (!pattern.test(memory.key)) continue;
      }

      // Filter by confidence
      if (options.minConfidence !== undefined && memory.confidence < options.minConfidence) {
        continue;
      }

      results.push(memory);
    }

    // Sort results
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        const aValue = a[options.sortBy!];
        const bValue = b[options.sortBy!];

        if (aValue instanceof Date && bValue instanceof Date) {
          return (aValue.getTime() - bValue.getTime()) * sortOrder;
        }
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * sortOrder;
        }
        return 0;
      });
    }

    // Apply limit
    if (options.limit && results.length > options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async upsert(
    userId: string,
    key: string,
    type: MemoryType,
    value: unknown,
    options: {
      confidence?: number;
      source?: string;
      metadata?: Record<string, unknown>;
      expiresAt?: Date;
    } = {}
  ): Promise<MemoryUpdateResult> {
    const existing = await this.getByKey(userId, key);
    const now = new Date();

    if (existing) {
      // Update existing memory
      const updated: MemoryEntry = {
        ...existing,
        value,
        confidence: options.confidence ?? existing.confidence,
        source: options.source ?? existing.source,
        metadata: options.metadata ?? existing.metadata,
        expiresAt: options.expiresAt ?? existing.expiresAt,
        updatedAt: now,
        lastAccessedAt: now,
      };
      this.memories.set(existing.id, updated);

      return {
        created: false,
        updated: true,
        memory: updated,
      };
    }

    // Create new memory
    const id = createMemoryId();
    const memory: MemoryEntry = {
      id,
      userId,
      type,
      key,
      value,
      confidence: options.confidence ?? 0.5,
      reinforceCount: 0,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
      expiresAt: options.expiresAt,
      source: options.source,
      metadata: options.metadata,
    };

    this.memories.set(id, memory);

    // Update user index
    if (!this.userIndex.has(userId)) {
      this.userIndex.set(userId, new Set());
    }
    this.userIndex.get(userId)!.add(id);

    // Update key index
    const indexKey = this.getUserKeyIndex(userId, key);
    this.keyIndex.set(indexKey, id);

    return {
      created: true,
      updated: false,
      memory,
    };
  }

  async delete(id: string): Promise<boolean> {
    const memory = this.memories.get(id);
    if (!memory) return false;

    // Remove from memories
    this.memories.delete(id);

    // Remove from user index
    const userIds = this.userIndex.get(memory.userId);
    if (userIds) {
      userIds.delete(id);
      if (userIds.size === 0) {
        this.userIndex.delete(memory.userId);
      }
    }

    // Remove from key index
    const indexKey = this.getUserKeyIndex(memory.userId, memory.key);
    this.keyIndex.delete(indexKey);

    return true;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const userMemoryIds = this.userIndex.get(userId);
    if (!userMemoryIds) return 0;

    let count = 0;
    for (const id of userMemoryIds) {
      const memory = this.memories.get(id);
      if (memory) {
        this.memories.delete(id);
        const indexKey = this.getUserKeyIndex(userId, memory.key);
        this.keyIndex.delete(indexKey);
        count++;
      }
    }

    this.userIndex.delete(userId);
    return count;
  }

  async reinforce(id: string): Promise<MemoryEntry | null> {
    const memory = this.memories.get(id);
    if (!memory) return null;

    const now = new Date();
    const updated: MemoryEntry = {
      ...memory,
      reinforceCount: memory.reinforceCount + 1,
      // Increase confidence with diminishing returns
      confidence: Math.min(1, memory.confidence + 0.1 * (1 - memory.confidence)),
      lastAccessedAt: now,
      updatedAt: now,
    };

    this.memories.set(id, updated);
    return updated;
  }

  async touch(id: string): Promise<void> {
    const memory = this.memories.get(id);
    if (memory) {
      memory.lastAccessedAt = new Date();
    }
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [id, memory] of this.memories) {
      if (memory.expiresAt && now > memory.expiresAt) {
        await this.delete(id);
        count++;
      }
    }

    return count;
  }

  async count(userId: string): Promise<number> {
    const userMemoryIds = this.userIndex.get(userId);
    return userMemoryIds?.size ?? 0;
  }

  /**
   * Clear all memories (for testing).
   */
  clear(): void {
    this.memories.clear();
    this.userIndex.clear();
    this.keyIndex.clear();
  }
}
