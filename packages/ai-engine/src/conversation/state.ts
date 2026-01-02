/**
 * Conversation State Management
 *
 * Manages multi-turn conversation state for each user.
 * Handles context tracking, entity collection, and session timeout.
 */

import type { IntentAction, ParsedEntities } from '@minori/shared';

export type ConversationPhase = 'idle' | 'collecting' | 'confirming' | 'processing';

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
}

/**
 * Required fields for each intent type.
 * Used to determine which fields need to be collected.
 */
const REQUIRED_FIELDS: Partial<Record<IntentAction, (keyof ParsedEntities)[]>> = {
  record_planting: ['crop', 'area'],
  record_harvest: ['crop', 'quantity'],
  record_growth: ['crop'],
};

/**
 * In-memory conversation state store.
 * TODO: Replace with Redis for production use.
 */
const stateStore = new Map<string, ConversationState>();

/**
 * Conversation timeout in milliseconds (5 minutes).
 */
const CONVERSATION_TIMEOUT = 5 * 60 * 1000;

/**
 * Maximum number of messages to keep in history.
 */
const MAX_HISTORY_LENGTH = 20;

/**
 * Gets or creates a conversation state for a user.
 * Automatically resets state if the session has timed out.
 *
 * @param userId - LINE user ID
 * @returns Current conversation state
 */
export function getConversationState(userId: string): ConversationState {
  const existing = stateStore.get(userId);

  // Check for timeout
  if (existing) {
    const elapsed = Date.now() - existing.lastInteractionAt.getTime();
    if (elapsed > CONVERSATION_TIMEOUT) {
      stateStore.delete(userId);
    } else {
      return existing;
    }
  }

  // Create new state
  const newState: ConversationState = {
    userId,
    phase: 'idle',
    collectedEntities: {},
    missingFields: [],
    history: [],
    lastInteractionAt: new Date(),
  };
  stateStore.set(userId, newState);
  return newState;
}

/**
 * Updates the conversation state for a user.
 *
 * @param userId - LINE user ID
 * @param updates - Partial state updates
 * @returns Updated conversation state
 */
export function updateConversationState(
  userId: string,
  updates: Partial<ConversationState>
): ConversationState {
  const state = getConversationState(userId);
  const updated: ConversationState = {
    ...state,
    ...updates,
    lastInteractionAt: new Date(),
  };
  stateStore.set(userId, updated);
  return updated;
}

/**
 * Resets the conversation state for a user.
 *
 * @param userId - LINE user ID
 */
export function resetConversationState(userId: string): void {
  stateStore.delete(userId);
}

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
 * Adds a message to the conversation history.
 * Automatically trims history to MAX_HISTORY_LENGTH.
 *
 * @param userId - LINE user ID
 * @param role - Message role ('user' or 'assistant')
 * @param content - Message content
 */
export function addToHistory(userId: string, role: 'user' | 'assistant', content: string): void {
  const state = getConversationState(userId);
  state.history.push({
    role,
    content,
    timestamp: new Date(),
  });

  // Trim history if too long
  if (state.history.length > MAX_HISTORY_LENGTH) {
    state.history = state.history.slice(-MAX_HISTORY_LENGTH);
  }

  updateConversationState(userId, { history: state.history });
}
