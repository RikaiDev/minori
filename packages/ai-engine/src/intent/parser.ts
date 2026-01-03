/**
 * Intent Parser Module
 *
 * Parses natural language input from farmers into structured intents.
 * Uses OpenAI GPT models for understanding and extraction.
 */

import OpenAI from 'openai';
import type { ParsedIntent, IntentAction, ParsedEntities } from '@minori/shared';
import { findCropByName } from '@minori/core';

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

/** Confidence threshold below which we consider the intent ambiguous */
export const CONFIDENCE_THRESHOLD = 0.7;

/** Confidence threshold below which we mark as unknown */
export const UNKNOWN_THRESHOLD = 0.3;

/**
 * Custom error class for intent parsing failures.
 */
export class IntentParseError extends Error {
  constructor(
    message: string,
    public readonly code: IntentParseErrorCode,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'IntentParseError';
  }
}

export type IntentParseErrorCode = 'API_ERROR' | 'PARSE_ERROR' | 'RATE_LIMITED' | 'UNKNOWN';

/**
 * Result type that includes clarification info for ambiguous intents.
 */
export interface ParseResult {
  intent: ParsedIntent;
  needsClarification: boolean;
  clarificationQuestion?: string;
  alternatives?: ParsedIntent[];
}

/**
 * System prompt for intent parsing.
 * Instructs the LLM to extract structured information from farmer input.
 */
const SYSTEM_PROMPT = `You are the intent parsing module for minori, an agricultural assistant.
Analyze farmer input and extract structured information.

## Supported Intents (action)
- record_planting: Record planting (keywords: 種、播種、下種、種了)
- record_growth: Record growth status (keywords: 長、生長、狀況、長得)
- record_harvest: Record harvest (keywords: 收、採、採收、收了)
- query_crops: Query my crops (keywords: 我的、有什麼、種了什麼)
- query_forecast: Query forecast (keywords: 什麼時候、預計、幾時)
- query_price: Query price (keywords: 價格、行情、多少錢)
- confirm: Confirm (keywords: 好、對、是、確認、沒錯)
- cancel: Cancel (keywords: 不要、取消、算了)
- help: Help (keywords: 怎麼用、幫助、說明)
- unknown: Cannot recognize

## Unit Reference
- Area: 1 jia (甲) = 10 plots (分地) = 2934 ping (坪) ≈ 0.97 hectare (公頃)
- Weight: 1 Taiwan jin (台斤) = 0.6 kg, 1 jin (斤) = 0.5 kg

## Date Parsing
- 今天、今日 → today
- 昨天、昨日 → yesterday
- 前天 → day before yesterday
- 上禮拜、上週 → last week

## Confidence Scoring
- 1.0: Clear, unambiguous intent with all required info
- 0.7-0.9: Intent clear but missing some optional info
- 0.4-0.7: Intent somewhat unclear or missing key info
- 0.0-0.4: Very unclear, likely unknown

## Clarification
If the input is ambiguous, include:
- missingInfo: array of what information is needed
- clarificationHint: suggested question to ask user

Respond ONLY with JSON containing:
- action: intent type
- entities: { crop, area, areaUnit, quantity, quantityUnit, dateExpression, condition }
- confidence: 0-1 confidence score
- missingInfo: optional array of missing information
- clarificationHint: optional clarification question in Traditional Chinese

Return only JSON, no other text.`;

/**
 * Parses user input into a structured intent with clarification support.
 *
 * @param text - User's natural language input
 * @returns Parse result with intent and clarification info
 *
 * @example
 * ```typescript
 * const result = await parseIntentWithClarification('種了小白菜');
 * if (result.needsClarification) {
 *   console.log(result.clarificationQuestion); // "請問種了多少面積？"
 * }
 * ```
 */
export async function parseIntentWithClarification(text: string): Promise<ParseResult> {
  const intent = await parseIntent(text);

  // Check if we need clarification
  if (intent.confidence < CONFIDENCE_THRESHOLD && intent.action !== 'unknown') {
    const clarificationQuestion = generateClarificationQuestion(intent);
    return {
      intent,
      needsClarification: true,
      clarificationQuestion,
    };
  }

  // If confidence is very low, mark as needing clarification
  if (intent.confidence < UNKNOWN_THRESHOLD) {
    return {
      intent,
      needsClarification: true,
      clarificationQuestion: '抱歉，我不太確定您的意思。請問您想要記錄種植、採收，還是查詢資料呢？',
    };
  }

  return {
    intent,
    needsClarification: false,
  };
}

/**
 * Generates a clarification question based on missing information.
 */
function generateClarificationQuestion(intent: ParsedIntent): string {
  const { action, entities } = intent;

  switch (action) {
    case 'record_planting':
      if (!entities.crop) {
        return '請問您種了什麼作物？';
      }
      if (!entities.area) {
        return `請問${entities.crop}種了多少面積？`;
      }
      break;

    case 'record_harvest':
      if (!entities.crop) {
        return '請問您採收了什麼作物？';
      }
      if (!entities.quantity) {
        return `請問${entities.crop}收了多少？`;
      }
      break;

    case 'query_forecast':
      if (!entities.crop) {
        return '請問您想查詢哪種作物的預計採收時間？';
      }
      break;

    case 'query_price':
      if (!entities.crop) {
        return '請問您想查詢哪種作物的價格？';
      }
      break;
  }

  return '請問可以說得更詳細一點嗎？';
}

/**
 * Parses user input into a structured intent.
 *
 * @param text - User's natural language input
 * @returns Parsed intent with action, entities, and confidence
 * @throws {IntentParseError} When parsing fails
 *
 * @example
 * ```typescript
 * const intent = await parseIntent('今天種了兩分地的小白菜');
 * // {
 * //   action: 'record_planting',
 * //   entities: { crop: '小白菜', area: 2, areaUnit: 'plot' },
 * //   confidence: 0.95
 * // }
 * ```
 */
export async function parseIntent(text: string): Promise<ParsedIntent> {
  // Handle empty input
  if (!text || text.trim().length === 0) {
    return createUnknownIntent(text);
  }

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return createUnknownIntent(text);
    }

    return parseResponse(content, text);
  } catch (error) {
    // Handle specific OpenAI errors
    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        throw new IntentParseError('Rate limit exceeded', 'RATE_LIMITED', error);
      }
      throw new IntentParseError(`API error: ${error.message}`, 'API_ERROR', error);
    }

    // For other errors, return unknown intent rather than throwing
    console.error('Intent parsing error:', error);
    return createUnknownIntent(text);
  }
}

/**
 * Parses the LLM response into a structured intent.
 */
function parseResponse(content: string, rawText: string): ParsedIntent {
  try {
    const parsed = JSON.parse(content) as {
      action: IntentAction;
      entities: ParsedEntities;
      confidence: number;
      missingInfo?: string[];
      clarificationHint?: string;
    };

    // Validate action
    const validActions: IntentAction[] = [
      'record_planting',
      'record_growth',
      'record_harvest',
      'query_crops',
      'query_forecast',
      'query_price',
      'confirm',
      'cancel',
      'help',
      'unknown',
    ];

    if (!validActions.includes(parsed.action)) {
      parsed.action = 'unknown';
      parsed.confidence = 0;
    }

    // Try to match crop name to database
    if (parsed.entities.crop) {
      const crop = findCropByName(parsed.entities.crop);
      if (crop) {
        parsed.entities.cropId = crop.id;
      }
    }

    // Parse date expression
    if (parsed.entities.dateExpression) {
      parsed.entities.date = parseDateExpression(parsed.entities.dateExpression);
    }

    // Normalize confidence to 0-1 range
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0));

    return {
      action: parsed.action,
      entities: parsed.entities,
      confidence,
      rawText,
    };
  } catch {
    return createUnknownIntent(rawText);
  }
}

/**
 * Creates an unknown intent result.
 */
function createUnknownIntent(text: string): ParsedIntent {
  return {
    action: 'unknown',
    entities: {},
    confidence: 0,
    rawText: text,
  };
}

/**
 * Parses Chinese date expressions into Date objects.
 *
 * @param expression - Date expression in Chinese
 * @returns Parsed Date object
 */
export function parseDateExpression(expression: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expr = expression.trim();

  if (expr.includes('今天') || expr.includes('今日')) {
    return today;
  }
  if (expr.includes('昨天') || expr.includes('昨日')) {
    return new Date(today.getTime() - 24 * 60 * 60 * 1000);
  }
  if (expr.includes('前天')) {
    return new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  }
  if (expr.includes('上禮拜') || expr.includes('上週')) {
    return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (expr.includes('這禮拜') || expr.includes('這週')) {
    return today;
  }

  return today;
}

/**
 * Checks if an intent requires specific entities to be complete.
 *
 * @param intent - Parsed intent to check
 * @returns Array of missing required entities
 */
export function getMissingEntities(intent: ParsedIntent): string[] {
  const missing: string[] = [];
  const { action, entities } = intent;

  switch (action) {
    case 'record_planting':
      if (!entities.crop) missing.push('crop');
      if (!entities.area) missing.push('area');
      break;

    case 'record_harvest':
      if (!entities.crop) missing.push('crop');
      if (!entities.quantity) missing.push('quantity');
      break;

    case 'query_price':
    case 'query_forecast':
      // These work better with crop specified, but not strictly required
      break;
  }

  return missing;
}

/**
 * Determines if an intent is complete (has all required entities).
 *
 * @param intent - Parsed intent to check
 * @returns true if the intent has all required entities
 */
export function isIntentComplete(intent: ParsedIntent): boolean {
  return getMissingEntities(intent).length === 0;
}
