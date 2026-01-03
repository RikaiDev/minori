/**
 * Conversation State Management
 *
 * Manages multi-turn conversation state for each user.
 * Handles context tracking, entity collection, and session timeout.
 */

import { t, type IntentAction, type ParsedEntities, type ParsedIntent } from '@minori/shared';

// ============================================================
// Types
// ============================================================

export type ConversationPhase =
  | 'idle'
  | 'collecting'
  | 'confirming'
  | 'processing'
  | 'completed'
  | 'cancelled';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ConversationState {
  userId: string;
  phase: ConversationPhase;
  currentIntent?: IntentAction;
  collectedEntities: Partial<ParsedEntities>;
  missingFields: string[];
  history: Message[];
  lastInteractionAt: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Result of processing a message in the conversation.
 */
export interface ProcessMessageResult {
  /** The response to send to the user */
  response: string;
  /** Whether the conversation is complete */
  isComplete: boolean;
  /** The action to take (if complete) */
  action?: IntentAction;
  /** The collected entities (if complete) */
  entities?: Partial<ParsedEntities>;
  /** Whether clarification is needed */
  needsClarification: boolean;
  /** Updated conversation state */
  state: ConversationState;
}

// ============================================================
// Storage Interface
// ============================================================

/**
 * Abstract storage interface for conversation state persistence.
 * Implement this interface to use different storage backends (Redis, PostgreSQL, etc.)
 */
export interface ConversationStorage {
  /** Get a conversation state by user ID */
  get(userId: string): Promise<ConversationState | null>;
  /** Save a conversation state */
  set(userId: string, state: ConversationState): Promise<void>;
  /** Delete a conversation state */
  delete(userId: string): Promise<void>;
  /** Delete expired conversations (optional cleanup) */
  deleteExpired?(maxAge: number): Promise<number>;
}

/**
 * In-memory storage implementation.
 * Suitable for development and single-instance deployments.
 */
export class InMemoryStorage implements ConversationStorage {
  private store = new Map<string, ConversationState>();

  async get(userId: string): Promise<ConversationState | null> {
    return this.store.get(userId) ?? null;
  }

  async set(userId: string, state: ConversationState): Promise<void> {
    this.store.set(userId, state);
  }

  async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }

  async deleteExpired(maxAge: number): Promise<number> {
    const now = Date.now();
    let deleted = 0;
    for (const [userId, state] of this.store.entries()) {
      if (now - state.lastInteractionAt.getTime() > maxAge) {
        this.store.delete(userId);
        deleted++;
      }
    }
    return deleted;
  }

  /** Get the number of stored conversations (for testing) */
  get size(): number {
    return this.store.size;
  }

  /** Clear all stored conversations (for testing) */
  clear(): void {
    this.store.clear();
  }
}

// ============================================================
// Constants
// ============================================================

/**
 * Conversation timeout in milliseconds (5 minutes).
 */
export const CONVERSATION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Maximum number of messages to keep in history.
 */
export const MAX_HISTORY_LENGTH = 20;

/**
 * Required fields for each intent type.
 */
export const REQUIRED_FIELDS: Partial<Record<IntentAction, (keyof ParsedEntities)[]>> = {
  record_planting: ['crop', 'area'],
  record_harvest: ['crop', 'quantity'],
  record_growth: ['crop'],
};

// ============================================================
// Default Storage Instance
// ============================================================

let defaultStorage: ConversationStorage = new InMemoryStorage();

/**
 * Sets the default storage implementation.
 * Call this at application startup to use a different storage backend.
 *
 * @param storage - Storage implementation to use
 */
export function setDefaultStorage(storage: ConversationStorage): void {
  defaultStorage = storage;
}

/**
 * Gets the current default storage implementation.
 */
export function getDefaultStorage(): ConversationStorage {
  return defaultStorage;
}

// ============================================================
// State Management Functions
// ============================================================

/**
 * Creates a new conversation state.
 */
export function createConversationState(userId: string): ConversationState {
  const now = new Date();
  return {
    userId,
    phase: 'idle',
    collectedEntities: {},
    missingFields: [],
    history: [],
    lastInteractionAt: now,
    createdAt: now,
  };
}

/**
 * Checks if a conversation state has expired.
 *
 * @param state - Conversation state to check
 * @param timeout - Timeout in milliseconds (default: CONVERSATION_TIMEOUT_MS)
 * @returns true if the state has expired
 */
export function isConversationExpired(
  state: ConversationState,
  timeout: number = CONVERSATION_TIMEOUT_MS
): boolean {
  const elapsed = Date.now() - state.lastInteractionAt.getTime();
  return elapsed > timeout;
}

/**
 * Gets or creates a conversation state for a user.
 * Automatically resets state if the session has timed out.
 *
 * @param userId - LINE user ID
 * @param storage - Storage to use (default: defaultStorage)
 * @returns Current conversation state
 */
export async function getConversationState(
  userId: string,
  storage: ConversationStorage = defaultStorage
): Promise<ConversationState> {
  const existing = await storage.get(userId);

  // Check for timeout
  if (existing) {
    if (isConversationExpired(existing)) {
      await storage.delete(userId);
    } else {
      return existing;
    }
  }

  // Create new state
  const newState = createConversationState(userId);
  await storage.set(userId, newState);
  return newState;
}

/**
 * Updates the conversation state for a user.
 *
 * @param userId - LINE user ID
 * @param updates - Partial state updates
 * @param storage - Storage to use (default: defaultStorage)
 * @returns Updated conversation state
 */
export async function updateConversationState(
  userId: string,
  updates: Partial<ConversationState>,
  storage: ConversationStorage = defaultStorage
): Promise<ConversationState> {
  const state = await getConversationState(userId, storage);
  const updated: ConversationState = {
    ...state,
    ...updates,
    lastInteractionAt: new Date(),
  };
  await storage.set(userId, updated);
  return updated;
}

/**
 * Resets the conversation state for a user.
 *
 * @param userId - LINE user ID
 * @param storage - Storage to use (default: defaultStorage)
 */
export async function resetConversationState(
  userId: string,
  storage: ConversationStorage = defaultStorage
): Promise<void> {
  await storage.delete(userId);
}

// ============================================================
// Entity Management
// ============================================================

/**
 * Gets the list of missing required fields for an intent.
 *
 * @param intent - Intent action type
 * @param entities - Currently collected entities
 * @returns Array of missing field names
 */
export function getMissingFields(
  intent: IntentAction,
  entities: Partial<ParsedEntities>
): (keyof ParsedEntities)[] {
  const required = REQUIRED_FIELDS[intent];
  if (!required) return [];

  return required.filter((field) => !entities[field]);
}

/**
 * Merges new entities with existing ones.
 * Only non-undefined values are merged.
 *
 * @param existing - Existing entities
 * @param incoming - New entities to merge
 * @returns Merged entities
 */
export function mergeEntities(
  existing: Partial<ParsedEntities>,
  incoming: Partial<ParsedEntities>
): Partial<ParsedEntities> {
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== undefined)),
  };
}

/**
 * Checks if all required fields are collected for an intent.
 *
 * @param intent - Intent action type
 * @param entities - Collected entities
 * @returns true if all required fields are present
 */
export function hasAllRequiredFields(
  intent: IntentAction,
  entities: Partial<ParsedEntities>
): boolean {
  return getMissingFields(intent, entities).length === 0;
}

// ============================================================
// History Management
// ============================================================

/**
 * Adds a message to the conversation history.
 * Automatically trims history to MAX_HISTORY_LENGTH.
 *
 * @param state - Current conversation state
 * @param role - Message role ('user' or 'assistant')
 * @param content - Message content
 * @returns Updated history array
 */
export function addMessageToHistory(
  state: ConversationState,
  role: 'user' | 'assistant',
  content: string
): Message[] {
  const newMessage: Message = {
    role,
    content,
    timestamp: new Date(),
  };

  let history = [...state.history, newMessage];

  // Trim history if too long
  if (history.length > MAX_HISTORY_LENGTH) {
    history = history.slice(-MAX_HISTORY_LENGTH);
  }

  return history;
}

/**
 * Adds a message to the conversation history and updates the state.
 *
 * @param userId - LINE user ID
 * @param role - Message role ('user' or 'assistant')
 * @param content - Message content
 * @param storage - Storage to use (default: defaultStorage)
 */
export async function addToHistory(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  storage: ConversationStorage = defaultStorage
): Promise<void> {
  const state = await getConversationState(userId, storage);
  const history = addMessageToHistory(state, role, content);
  await updateConversationState(userId, { history }, storage);
}

/**
 * Gets the recent conversation context as a string.
 * Useful for providing context to the LLM.
 *
 * @param state - Conversation state
 * @param maxMessages - Maximum number of messages to include (default: 5)
 * @returns Formatted conversation context
 */
export function getConversationContext(state: ConversationState, maxMessages: number = 5): string {
  const recentMessages = state.history.slice(-maxMessages);

  if (recentMessages.length === 0) {
    return '';
  }

  return recentMessages
    .map((msg) => `${msg.role === 'user' ? '用戶' : '助理'}: ${msg.content}`)
    .join('\n');
}

// ============================================================
// State Transition Helpers
// ============================================================

/**
 * Transitions the conversation to the collecting phase.
 *
 * @param state - Current conversation state
 * @param intent - Intent to collect entities for
 * @param entities - Initial entities
 * @returns Updated state
 */
export function transitionToCollecting(
  state: ConversationState,
  intent: IntentAction,
  entities: Partial<ParsedEntities>
): ConversationState {
  const missingFields = getMissingFields(intent, entities);
  return {
    ...state,
    phase: 'collecting',
    currentIntent: intent,
    collectedEntities: entities,
    missingFields: missingFields as string[],
    lastInteractionAt: new Date(),
  };
}

/**
 * Transitions the conversation to the confirming phase.
 *
 * @param state - Current conversation state
 * @returns Updated state
 */
export function transitionToConfirming(state: ConversationState): ConversationState {
  return {
    ...state,
    phase: 'confirming',
    missingFields: [],
    lastInteractionAt: new Date(),
  };
}

/**
 * Transitions the conversation to the completed phase.
 *
 * @param state - Current conversation state
 * @returns Updated state
 */
export function transitionToCompleted(state: ConversationState): ConversationState {
  return {
    ...state,
    phase: 'completed',
    lastInteractionAt: new Date(),
  };
}

/**
 * Transitions the conversation to the cancelled phase.
 *
 * @param state - Current conversation state
 * @returns Updated state
 */
export function transitionToCancelled(state: ConversationState): ConversationState {
  return {
    ...state,
    phase: 'cancelled',
    lastInteractionAt: new Date(),
  };
}

/**
 * Resets the conversation to idle phase while preserving history.
 *
 * @param state - Current conversation state
 * @returns Updated state
 */
export function transitionToIdle(state: ConversationState): ConversationState {
  return {
    ...state,
    phase: 'idle',
    currentIntent: undefined,
    collectedEntities: {},
    missingFields: [],
    lastInteractionAt: new Date(),
  };
}

// ============================================================
// Conversation Manager
// ============================================================

/**
 * Options for the ConversationManager.
 */
export interface ConversationManagerOptions {
  /** Storage implementation to use */
  storage?: ConversationStorage;
  /** Conversation timeout in milliseconds */
  timeout?: number;
  /** Maximum history length */
  maxHistoryLength?: number;
}

/**
 * Manages multi-turn conversations with context carryover.
 *
 * @example
 * ```typescript
 * const manager = new ConversationManager();
 *
 * // Process a new intent
 * const result = await manager.processIntent(userId, parsedIntent);
 *
 * if (result.needsClarification) {
 *   // Ask for missing information
 *   await sendMessage(result.response);
 * } else if (result.isComplete) {
 *   // Execute the action
 *   await executeAction(result.action, result.entities);
 * }
 * ```
 */
export class ConversationManager {
  private storage: ConversationStorage;
  private timeout: number;

  constructor(options: ConversationManagerOptions = {}) {
    this.storage = options.storage ?? defaultStorage;
    this.timeout = options.timeout ?? CONVERSATION_TIMEOUT_MS;
  }

  /**
   * Gets the current conversation state for a user.
   */
  async getState(userId: string): Promise<ConversationState> {
    return getConversationState(userId, this.storage);
  }

  /**
   * Processes a parsed intent and returns the appropriate response.
   *
   * @param userId - LINE user ID
   * @param intent - Parsed intent from the user's message
   * @returns Processing result with response and state
   */
  async processIntent(userId: string, intent: ParsedIntent): Promise<ProcessMessageResult> {
    const state = await this.getState(userId);

    // Handle special intents
    if (intent.action === 'cancel') {
      return this.handleCancel(userId, state);
    }

    if (intent.action === 'confirm') {
      return this.handleConfirm(userId, state);
    }

    if (intent.action === 'help') {
      return this.handleHelp(userId, state);
    }

    // Handle intents that don't require entity collection
    if (!REQUIRED_FIELDS[intent.action]) {
      return this.handleSimpleIntent(userId, state, intent);
    }

    // Handle intents that require entity collection
    return this.handleCollectingIntent(userId, state, intent);
  }

  /**
   * Adds additional entities to the current conversation.
   * Used when the user provides missing information.
   *
   * @param userId - LINE user ID
   * @param entities - Additional entities to add
   * @returns Processing result
   */
  async addEntities(
    userId: string,
    entities: Partial<ParsedEntities>
  ): Promise<ProcessMessageResult> {
    const state = await this.getState(userId);

    if (state.phase !== 'collecting' || !state.currentIntent) {
      return {
        response: t('intent.noActiveConversation'),
        isComplete: false,
        needsClarification: false,
        state,
      };
    }

    // Merge entities
    const merged = mergeEntities(state.collectedEntities, entities);
    const missing = getMissingFields(state.currentIntent, merged);

    if (missing.length === 0) {
      // All fields collected, move to confirming
      const updatedState = await updateConversationState(
        userId,
        {
          ...transitionToConfirming(state),
          collectedEntities: merged,
        },
        this.storage
      );

      return {
        response: this.buildConfirmationMessage(state.currentIntent, merged),
        isComplete: false,
        needsClarification: false,
        state: updatedState,
      };
    }

    // Still missing fields
    const updatedState = await updateConversationState(
      userId,
      {
        collectedEntities: merged,
        missingFields: missing as string[],
      },
      this.storage
    );

    return {
      response: this.buildClarificationMessage(missing as string[], state.currentIntent),
      isComplete: false,
      needsClarification: true,
      state: updatedState,
    };
  }

  /**
   * Records a user message in the conversation history.
   */
  async recordUserMessage(userId: string, content: string): Promise<void> {
    await addToHistory(userId, 'user', content, this.storage);
  }

  /**
   * Records an assistant message in the conversation history.
   */
  async recordAssistantMessage(userId: string, content: string): Promise<void> {
    await addToHistory(userId, 'assistant', content, this.storage);
  }

  /**
   * Resets the conversation for a user.
   */
  async reset(userId: string): Promise<void> {
    await resetConversationState(userId, this.storage);
  }

  // ============================================================
  // Private Handlers
  // ============================================================

  private async handleCancel(
    userId: string,
    state: ConversationState
  ): Promise<ProcessMessageResult> {
    const updatedState = await updateConversationState(
      userId,
      transitionToCancelled(state),
      this.storage
    );

    // Reset after cancellation
    await this.reset(userId);

    return {
      response: t('intent.cancelled'),
      isComplete: false,
      needsClarification: false,
      state: updatedState,
    };
  }

  private async handleConfirm(
    userId: string,
    state: ConversationState
  ): Promise<ProcessMessageResult> {
    if (state.phase !== 'confirming' || !state.currentIntent) {
      return {
        response: t('intent.nothingToConfirm'),
        isComplete: false,
        needsClarification: false,
        state,
      };
    }

    const updatedState = await updateConversationState(
      userId,
      transitionToCompleted(state),
      this.storage
    );

    return {
      response: t('intent.confirmed'),
      isComplete: true,
      action: state.currentIntent,
      entities: state.collectedEntities,
      needsClarification: false,
      state: updatedState,
    };
  }

  private async handleHelp(
    userId: string,
    state: ConversationState
  ): Promise<ProcessMessageResult> {
    const helpMessage = [
      t('help.intro'),
      t('help.recording'),
      t('help.harvesting'),
      t('help.querying'),
      '',
      t('help.closing'),
    ].join('\n');

    return {
      response: helpMessage,
      isComplete: false,
      needsClarification: false,
      state,
    };
  }

  private async handleSimpleIntent(
    userId: string,
    state: ConversationState,
    intent: ParsedIntent
  ): Promise<ProcessMessageResult> {
    // Reset any previous conversation context
    const updatedState = await updateConversationState(
      userId,
      transitionToIdle(state),
      this.storage
    );

    return {
      response: '',
      isComplete: true,
      action: intent.action,
      entities: intent.entities,
      needsClarification: false,
      state: updatedState,
    };
  }

  private async handleCollectingIntent(
    userId: string,
    state: ConversationState,
    intent: ParsedIntent
  ): Promise<ProcessMessageResult> {
    // Merge with any existing entities (for multi-turn collection)
    const merged =
      state.phase === 'collecting' && state.currentIntent === intent.action
        ? mergeEntities(state.collectedEntities, intent.entities)
        : intent.entities;

    const missing = getMissingFields(intent.action, merged);

    if (missing.length === 0) {
      // All fields present, move to confirming
      const updatedState = await updateConversationState(
        userId,
        {
          ...transitionToConfirming(state),
          currentIntent: intent.action,
          collectedEntities: merged,
        },
        this.storage
      );

      return {
        response: this.buildConfirmationMessage(intent.action, merged),
        isComplete: false,
        needsClarification: false,
        state: updatedState,
      };
    }

    // Missing fields, move to collecting
    const updatedState = await updateConversationState(
      userId,
      transitionToCollecting(state, intent.action, merged),
      this.storage
    );

    return {
      response: this.buildClarificationMessage(missing as string[], intent.action),
      isComplete: false,
      needsClarification: true,
      state: updatedState,
    };
  }

  // ============================================================
  // Message Builders
  // ============================================================

  private buildClarificationMessage(missingFields: string[], intent?: IntentAction): string {
    const firstMissing = missingFields[0];
    if (!firstMissing) {
      return t('common.askMoreDetail');
    }

    // Map missing field to appropriate i18n key based on intent
    const fieldKeyMap: Record<string, Record<string, string>> = {
      crop: {
        record_planting: 'record.planting.askCrop',
        record_harvest: 'record.harvest.askCrop',
        record_growth: 'record.growth.askCrop',
      },
      area: {
        record_planting: 'record.planting.askArea',
      },
      quantity: {
        record_harvest: 'record.harvest.askQuantity',
      },
    };

    const intentKey = intent ? fieldKeyMap[firstMissing]?.[intent] : undefined;
    if (intentKey) {
      return t(intentKey, { crop: '這個作物' });
    }

    return t('common.askMoreDetail');
  }

  private buildConfirmationMessage(
    intent: IntentAction,
    entities: Partial<ParsedEntities>
  ): string {
    const crop = entities.crop ?? '?';
    const area = entities.area ?? '?';
    const quantity = entities.quantity ?? '?';
    const unit =
      entities.quantityUnit === 'taiwanJin' ? t('units.weight.taiwanJin') : t('units.weight.kg');

    switch (intent) {
      case 'record_planting':
        return t('conversation.confirm.planting', { crop, area });
      case 'record_harvest':
        return t('conversation.confirm.harvest', { crop, quantity, unit });
      case 'record_growth':
        return t('conversation.confirm.growth', { crop });
      default:
        return t('conversation.confirm.default');
    }
  }
}
