/**
 * Intent Parser Module
 *
 * Parses natural language input from farmers into structured intents.
 * Uses OpenAI GPT models for understanding and extraction.
 */

import OpenAI from 'openai';
import type { ParsedIntent, IntentAction, ParsedEntities } from '@minori/shared';
import { findCropByName } from '@minori/core';

const openai = new OpenAI();

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

Respond ONLY with JSON containing:
- action: intent type
- entities: { crop, area, areaUnit, quantity, quantityUnit, dateExpression, condition }
- confidence: 0-1 confidence score

Return only JSON, no other text.`;

/**
 * Parses user input into a structured intent.
 *
 * @param text - User's natural language input
 * @returns Parsed intent with action, entities, and confidence
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
  const response = await openai.chat.completions.create({
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

  try {
    const parsed = JSON.parse(content) as {
      action: IntentAction;
      entities: ParsedEntities;
      confidence: number;
    };

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

    return {
      action: parsed.action,
      entities: parsed.entities,
      confidence: parsed.confidence,
      rawText: text,
    };
  } catch {
    return createUnknownIntent(text);
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
function parseDateExpression(expression: string): Date {
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

  return today;
}
