/**
 * Message Handler Module
 *
 * Handles incoming webhook events from LINE and routes them
 * to appropriate handlers based on message type.
 * Supports multi-turn conversations with confirmation flow.
 */

import type { webhook } from '@line/bot-sdk';

type WebhookEvent = webhook.Event;
type MessageEvent = webhook.MessageEvent;
type TextMessageContent = webhook.TextMessageContent;
import {
  replyText,
  replyWithQuickReply,
  QuickReplyPresets,
  type QuickReplyButton,
} from '../client';
import { parseIntent, ConversationManager, type ProcessMessageResult } from '@minori/ai-engine';
import { findCropByName, predictHarvest, getCropById, PriceService } from '@minori/core';
import { t, formatDate } from '@minori/shared';
import type { ParsedIntent, ParsedEntities } from '@minori/shared';
import { handleCooperativeAction } from './cooperative-handler';

/**
 * Response with optional quick reply buttons.
 */
interface MessageResponse {
  text: string;
  quickReply?: QuickReplyButton[];
}

/**
 * Singleton conversation manager instance.
 */
const conversationManager = new ConversationManager();

/**
 * Handles a webhook event from LINE.
 *
 * @param event - Webhook event from LINE
 */
export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message') {
    return;
  }

  // Ensure we have a reply token
  const replyToken = event.replyToken;
  if (!replyToken) {
    return;
  }

  // Route to appropriate handler based on message type
  switch (event.message.type) {
    case 'text':
      await handleTextMessage(event as MessageEvent & { message: TextMessageContent }, replyToken);
      break;
    case 'audio':
      // Handled by audio-handler
      break;
    case 'image':
      // Handled by image-handler
      break;
    default:
      await replyText(replyToken, t('error.unsupportedMessage'));
  }
}

/**
 * Handles text messages from users.
 *
 * @param event - Message event with text content
 * @param replyToken - Reply token for responding
 */
async function handleTextMessage(
  event: MessageEvent & { message: TextMessageContent },
  replyToken: string
): Promise<void> {
  const text = event.message.text;
  const userId = event.source?.userId;

  if (!userId) {
    return;
  }

  try {
    // Record user message in history
    await conversationManager.recordUserMessage(userId, text);

    // Parse intent from text
    const intent = await parseIntent(text);

    // Process through conversation manager for multi-turn support
    const result = await conversationManager.processIntent(userId, intent);

    // Handle the result
    const response = await handleConversationResult(result, intent, userId);

    // Record assistant response in history
    await conversationManager.recordAssistantMessage(userId, response.text);

    // Reply with or without quick reply buttons
    if (response.quickReply && response.quickReply.length > 0) {
      await replyWithQuickReply(replyToken, response.text, response.quickReply);
    } else {
      await replyText(replyToken, response.text);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    await replyText(replyToken, t('error.general'));
  }
}

/**
 * Handles the result from the conversation manager.
 *
 * @param result - Result from processIntent
 * @param intent - Original parsed intent
 * @param userId - LINE user ID
 * @returns Message response with text and quick reply buttons
 */
async function handleConversationResult(
  result: ProcessMessageResult,
  intent: ParsedIntent,
  userId: string
): Promise<MessageResponse> {
  // If conversation is complete, execute the action
  if (result.isComplete && result.action) {
    return executeAction(result.action, result.entities || {}, userId);
  }

  // If needs clarification, return with appropriate quick replies
  if (result.needsClarification) {
    return {
      text: result.response,
      quickReply: getQuickReplyForMissingField(result.state.missingFields[0], intent.action),
    };
  }

  // If in confirming phase, show confirmation with confirm/cancel buttons
  if (result.state.phase === 'confirming') {
    return {
      text: result.response,
      quickReply: QuickReplyPresets.confirm(),
    };
  }

  // Default response (help, cancelled, etc.)
  return {
    text: result.response || t('intent.unknown'),
    quickReply: QuickReplyPresets.mainMenu(),
  };
}

/**
 * Gets quick reply buttons based on the missing field.
 */
function getQuickReplyForMissingField(
  missingField: string | undefined,
  _action: string
): QuickReplyButton[] {
  if (!missingField) {
    return QuickReplyPresets.helpCancel();
  }

  switch (missingField) {
    case 'crop':
      return QuickReplyPresets.commonCrops();
    case 'area':
      return QuickReplyPresets.areaUnits();
    case 'quantity':
      return [
        { label: '10公斤', text: '10公斤' },
        { label: '20公斤', text: '20公斤' },
        { label: '50公斤', text: '50公斤' },
        { label: '100公斤', text: '100公斤' },
      ];
    default:
      return QuickReplyPresets.helpCancel();
  }
}

/**
 * Executes the completed action.
 *
 * @param action - Action to execute
 * @param entities - Collected entities
 * @param userId - LINE user ID
 * @returns Response message
 */
async function executeAction(
  action: string,
  entities: Partial<ParsedEntities>,
  userId: string
): Promise<MessageResponse> {
  switch (action) {
    case 'record_planting':
      return handleRecordPlanting(entities);

    case 'record_harvest':
      return handleRecordHarvest(entities);

    case 'record_growth':
      return handleRecordGrowth(entities);

    case 'query_crops':
      return handleQueryCrops(userId);

    case 'query_forecast':
      return handleQueryForecast(entities);

    case 'query_price':
      return handleQueryPrice(entities);

    // Cooperative intents
    case 'query_member_crops':
    case 'query_supply':
    case 'export_report':
      return handleCooperativeAction(action, entities, userId);

    case 'confirm':
      return {
        text: t('intent.confirmed'),
        quickReply: QuickReplyPresets.mainMenu(),
      };

    case 'cancel':
      return {
        text: t('intent.cancelled'),
        quickReply: QuickReplyPresets.mainMenu(),
      };

    case 'help':
      return {
        text: getHelpMessage(),
        quickReply: QuickReplyPresets.mainMenu(),
      };

    case 'unknown':
    default:
      return {
        text: t('intent.unknown'),
        quickReply: QuickReplyPresets.helpCancel(),
      };
  }
}

/**
 * Handles planting record action.
 *
 * @param entities - Collected entities
 * @returns Response with text and quick reply buttons
 */
function handleRecordPlanting(entities: Partial<ParsedEntities>): MessageResponse {
  const { crop, area, areaUnit } = entities;

  if (!crop || !area) {
    return {
      text: t('intent.unknown'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }

  // Get crop info for prediction
  const cropInfo = findCropByName(crop);

  let response = t('record.planting.success', {
    crop,
    area,
    unit: areaUnit || t('units.area.plots'),
  });

  // Add prediction if crop info is available
  if (cropInfo) {
    const prediction = predictHarvest(cropInfo, new Date());
    const likelyDate = formatDate(prediction.predictions.likely);

    response += '\n\n' + t('record.planting.predictedHarvest', { date: likelyDate });
    response +=
      '\n' + t('record.planting.optimalTemp', { temp: cropInfo.growth.temperatureOptimal });
  }

  // TODO: Save record to database

  return {
    text: response,
    quickReply: QuickReplyPresets.afterPlanting(),
  };
}

/**
 * Handles harvest record action.
 *
 * @param entities - Collected entities
 * @returns Response with text and quick reply buttons
 */
function handleRecordHarvest(entities: Partial<ParsedEntities>): MessageResponse {
  const { crop, quantity, quantityUnit } = entities;

  if (!crop || !quantity) {
    return {
      text: t('intent.unknown'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }

  let response = t('record.harvest.success', {
    crop,
    quantity,
    unit: quantityUnit || t('units.weight.kg'),
  });

  response += '\n\n' + t('record.harvest.notifyCooperative');

  // TODO: Save record to database

  return {
    text: response,
    quickReply: QuickReplyPresets.afterHarvest(),
  };
}

/**
 * Handles growth record action.
 *
 * @param entities - Collected entities
 * @returns Response with text and quick reply buttons
 */
function handleRecordGrowth(entities: Partial<ParsedEntities>): MessageResponse {
  const { crop, condition: _condition } = entities;

  if (!crop) {
    return {
      text: t('intent.unknown'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }

  const response = t('record.growth.success', { crop });

  // TODO: Save record to database with condition

  return {
    text: response,
    quickReply: QuickReplyPresets.mainMenu(),
  };
}

/**
 * Handles crop query action.
 * Shows the user's recorded crops with harvest predictions.
 *
 * @param userId - LINE user ID
 * @returns Response with crop list
 */
async function handleQueryCrops(_userId: string): Promise<MessageResponse> {
  // TODO: Fetch actual records from database
  // For now, return a demo response

  // Check if user has any records (placeholder)
  const hasRecords = false;

  if (!hasRecords) {
    return {
      text: t('query.crops.empty') + '\n\n' + t('help.recording'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }

  // TODO: Build actual crop list from database records
  const cropList = t('query.crops.title');

  return {
    text: cropList,
    quickReply: QuickReplyPresets.mainMenu(),
  };
}

/**
 * Handles forecast query action.
 * Shows harvest prediction for a specific crop.
 *
 * @param entities - Collected entities (may include crop)
 * @returns Response with forecast
 */
async function handleQueryForecast(entities: Partial<ParsedEntities>): Promise<MessageResponse> {
  const { crop, cropId } = entities;

  // If no crop specified, show general help
  if (!crop) {
    return {
      text: t('query.forecast.askCrop'),
      quickReply: QuickReplyPresets.commonCrops(),
    };
  }

  // Get crop info
  const cropInfo = cropId ? getCropById(cropId) : findCropByName(crop);

  if (!cropInfo) {
    return {
      text: t('query.forecast.cropNotFound', { crop }),
      quickReply: QuickReplyPresets.commonCrops(),
    };
  }

  // Calculate prediction (assuming planting today)
  const prediction = predictHarvest(cropInfo, new Date());

  const response = [
    t('query.forecast.title', { crop: cropInfo.name }),
    '',
    t('query.forecast.prediction', {
      earliest: formatDate(prediction.predictions.earliest),
      likely: formatDate(prediction.predictions.likely),
      latest: formatDate(prediction.predictions.latest),
    }),
    '',
    t('query.forecast.confidence', {
      confidence: Math.round(prediction.confidence * 100),
    }),
    '',
    t('query.forecast.optimalTemp', {
      temp: cropInfo.growth.temperatureOptimal,
    }),
  ].join('\n');

  return {
    text: response,
    quickReply: QuickReplyPresets.mainMenu(),
  };
}

/**
 * Handles price query action.
 * Shows current market prices for a crop.
 *
 * @param entities - Collected entities (may include crop)
 * @returns Response with price info
 */
async function handleQueryPrice(entities: Partial<ParsedEntities>): Promise<MessageResponse> {
  const { crop, cropId } = entities;

  // If no crop specified, ask which crop
  if (!crop) {
    return {
      text: t('query.price.askCrop'),
      quickReply: QuickReplyPresets.commonCrops(),
    };
  }

  // Get crop info
  const cropInfo = cropId ? getCropById(cropId) : findCropByName(crop);

  if (!cropInfo) {
    return {
      text: t('query.price.cropNotFound', { crop }),
      quickReply: QuickReplyPresets.commonCrops(),
    };
  }

  try {
    // Get price data
    const priceService = new PriceService();
    const stats = await priceService.getCropPriceStats(cropInfo.name);

    if (!stats) {
      return {
        text: t('query.price.noData', { crop: cropInfo.name }),
        quickReply: QuickReplyPresets.mainMenu(),
      };
    }

    const trendIcon = stats.trend === 'up' ? '📈' : stats.trend === 'down' ? '📉' : '➡️';
    const changeSign = stats.weeklyChange >= 0 ? '+' : '';

    const response = [
      t('query.price.title', { crop: cropInfo.name }),
      '',
      t('query.price.current', { price: stats.currentPrice.toFixed(1) }),
      t('query.price.trend', {
        icon: trendIcon,
        change: `${changeSign}${stats.weeklyChange.toFixed(1)}`,
      }),
      '',
      t('query.price.range', {
        low: stats.priceLow.toFixed(1),
        high: stats.priceHigh.toFixed(1),
      }),
    ].join('\n');

    return {
      text: response,
      quickReply: QuickReplyPresets.mainMenu(),
    };
  } catch (error) {
    console.error('Error fetching price:', error);
    return {
      text: t('query.price.error'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }
}

/**
 * Gets the help message for users.
 *
 * @returns Formatted help message
 */
function getHelpMessage(): string {
  return [
    t('help.title'),
    '',
    t('help.intro'),
    t('help.recording'),
    t('help.harvesting'),
    t('help.querying'),
    '',
    t('help.voice'),
    t('help.voiceOption'),
    t('help.photoOption'),
    '',
    t('help.closing'),
  ].join('\n');
}

/**
 * Gets the conversation manager instance (for testing).
 */
export function getConversationManager(): ConversationManager {
  return conversationManager;
}
