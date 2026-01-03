/**
 * Memory System Types
 *
 * Type definitions for the memory system that persists
 * conversation context and user preferences.
 */

/**
 * Memory entry types.
 */
export type MemoryType =
  | 'preference' // User preferences (language, defaults)
  | 'crop_pattern' // Common crop patterns for the user
  | 'entity' // Extracted entities from conversations
  | 'fact' // Facts about the user or their operation
  | 'interaction'; // Interaction patterns

/**
 * Base memory entry structure.
 */
export interface MemoryEntry {
  /** Unique identifier */
  id: string;
  /** User ID this memory belongs to */
  userId: string;
  /** Type of memory */
  type: MemoryType;
  /** Memory key (for lookup) */
  key: string;
  /** Memory value */
  value: unknown;
  /** Confidence score (0-1) */
  confidence: number;
  /** Number of times this memory was reinforced */
  reinforceCount: number;
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Expiration timestamp (optional) */
  expiresAt?: Date;
  /** Source of this memory */
  source?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User preferences memory.
 */
export interface UserPreferences {
  /** Preferred locale */
  locale?: 'zh-TW' | 'en';
  /** Default area unit */
  defaultAreaUnit?: 'plot' | 'jia' | 'ping' | 'hectare';
  /** Default weight unit */
  defaultWeightUnit?: 'kg' | 'jin' | 'taiwanJin';
  /** Common crops (sorted by frequency) */
  commonCrops?: string[];
  /** Typical area sizes for planting */
  typicalAreaSizes?: number[];
  /** Typical harvest quantities */
  typicalQuantities?: number[];
  /** Preferred confirmation style */
  confirmationStyle?: 'detailed' | 'brief';
  /** Custom shortcuts or aliases */
  aliases?: Record<string, string>;
}

/**
 * Crop pattern memory.
 * Tracks patterns in how a user works with specific crops.
 */
export interface CropPattern {
  /** Crop ID */
  cropId: string;
  /** Crop name */
  cropName: string;
  /** Number of times planted */
  plantCount: number;
  /** Number of times harvested */
  harvestCount: number;
  /** Average area size planted */
  avgAreaSize?: number;
  /** Average harvest quantity */
  avgHarvestQuantity?: number;
  /** Typical planting seasons */
  typicalSeasons?: string[];
  /** Last planted date */
  lastPlantedAt?: Date;
  /** Last harvested date */
  lastHarvestedAt?: Date;
}

/**
 * Entity memory.
 * Stores extracted entities for context.
 */
export interface EntityMemory {
  /** Entity type (crop, area, quantity, etc.) */
  entityType: string;
  /** Entity value */
  value: string | number;
  /** Normalized value */
  normalizedValue?: string | number;
  /** Context in which it was extracted */
  context?: string;
  /** Frequency of occurrence */
  frequency: number;
}

/**
 * Fact memory.
 * Stores facts about the user or their operation.
 */
export interface FactMemory {
  /** Fact subject (e.g., "user", "field", "cooperative") */
  subject: string;
  /** Fact predicate (e.g., "has", "is", "prefers") */
  predicate: string;
  /** Fact object */
  object: string | number | boolean;
  /** When this fact was established */
  establishedAt: Date;
  /** Whether this is a permanent or temporary fact */
  permanent: boolean;
}

/**
 * Interaction pattern.
 * Tracks interaction patterns for personalization.
 */
export interface InteractionPattern {
  /** Pattern type */
  patternType: 'time' | 'frequency' | 'sequence';
  /** Pattern description */
  description: string;
  /** Pattern data */
  data: Record<string, unknown>;
  /** Confidence in this pattern */
  confidence: number;
}

/**
 * User memory profile.
 * Aggregated view of all memories for a user.
 */
export interface UserMemoryProfile {
  /** User ID */
  userId: string;
  /** User preferences */
  preferences: UserPreferences;
  /** Crop patterns */
  cropPatterns: CropPattern[];
  /** Facts about the user */
  facts: FactMemory[];
  /** Interaction patterns */
  interactionPatterns: InteractionPattern[];
  /** Total memory count */
  totalMemories: number;
  /** Last updated timestamp */
  lastUpdatedAt: Date;
}

/**
 * Memory query options.
 */
export interface MemoryQueryOptions {
  /** Filter by memory type */
  type?: MemoryType;
  /** Filter by key pattern */
  keyPattern?: string;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum number of results */
  limit?: number;
  /** Sort by field */
  sortBy?: 'confidence' | 'reinforceCount' | 'lastAccessedAt' | 'createdAt';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Include expired memories */
  includeExpired?: boolean;
}

/**
 * Memory update result.
 */
export interface MemoryUpdateResult {
  /** Whether a new memory was created */
  created: boolean;
  /** Whether an existing memory was updated */
  updated: boolean;
  /** The memory entry */
  memory: MemoryEntry;
}
