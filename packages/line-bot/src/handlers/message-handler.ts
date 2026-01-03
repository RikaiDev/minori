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
import { getFieldRecordService } from '../services/field-record-service';

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
      return handleRecordPlanting(entities, userId);

    case 'record_harvest':
      return handleRecordHarvest(entities, userId);

    case 'record_growth':
      return handleRecordGrowth(entities, userId);

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
 * @param lineUserId - LINE user ID
 * @returns Response with text and quick reply buttons
 */
async function handleRecordPlanting(
  entities: Partial<ParsedEntities>,
  lineUserId: string
): Promise<MessageResponse> {
  const { crop, cropId, area, areaUnit } = entities;

  if (!crop || !area) {
    return {
      text: t('intent.unknown'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }

  // Get crop info for prediction
  const cropInfo = cropId ? getCropById(cropId) : findCropByName(crop);

  try {
    // Save record to database
    const fieldRecordService = getFieldRecordService();
    const record = await fieldRecordService.createPlantingRecord({
      lineUserId,
      cropId: cropInfo?.id ?? 'unknown',
      cropName: cropInfo?.name ?? crop,
      area,
    });

    let response = t('record.planting.success', {
      crop,
      area,
      unit: areaUnit || t('units.area.plots'),
    });

    // Add prediction if available
    if (record.expectedHarvestDate) {
      const likelyDate = formatDate(record.expectedHarvestDate);
      response += '\n\n' + t('record.planting.predictedHarvest', { date: likelyDate });
    }

    if (cropInfo) {
      response +=
        '\n' + t('record.planting.optimalTemp', { temp: cropInfo.growth.temperatureOptimal });
    }

    return {
      text: response,
      quickReply: QuickReplyPresets.afterPlanting(),
    };
  } catch (error) {
    console.error('Error saving planting record:', error);

    // Fall back to response without database
    let response = t('record.planting.success', {
      crop,
      area,
      unit: areaUnit || t('units.area.plots'),
    });

    if (cropInfo) {
      const prediction = predictHarvest(cropInfo, new Date());
      const likelyDate = formatDate(prediction.predictions.likely);
      response += '\n\n' + t('record.planting.predictedHarvest', { date: likelyDate });
      response +=
        '\n' + t('record.planting.optimalTemp', { temp: cropInfo.growth.temperatureOptimal });
    }

    return {
      text: response,
      quickReply: QuickReplyPresets.afterPlanting(),
    };
  }
}

/**
 * Handles harvest record action.
 *
 * @param entities - Collected entities
 * @param lineUserId - LINE user ID
 * @returns Response with text and quick reply buttons
 */
async function handleRecordHarvest(
  entities: Partial<ParsedEntities>,
  lineUserId: string
): Promise<MessageResponse> {
  const { crop, quantity, quantityUnit } = entities;

  if (!crop || !quantity) {
    return {
      text: t('intent.unknown'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }

  try {
    // Save record to database
    const fieldRecordService = getFieldRecordService();
    await fieldRecordService.createHarvestRecord({
      lineUserId,
      cropName: crop,
      quantity,
    });

    let response = t('record.harvest.success', {
      crop,
      quantity,
      unit: quantityUnit || t('units.weight.kg'),
    });

    response += '\n\n' + t('record.harvest.notifyCooperative');

    return {
      text: response,
      quickReply: QuickReplyPresets.afterHarvest(),
    };
  } catch (error) {
    console.error('Error saving harvest record:', error);

    // Fall back to response without database
    let response = t('record.harvest.success', {
      crop,
      quantity,
      unit: quantityUnit || t('units.weight.kg'),
    });

    response += '\n\n' + t('record.harvest.notifyCooperative');

    return {
      text: response,
      quickReply: QuickReplyPresets.afterHarvest(),
    };
  }
}

/**
 * Handles growth record action.
 *
 * @param entities - Collected entities
 * @param lineUserId - LINE user ID
 * @returns Response with text and quick reply buttons
 */
async function handleRecordGrowth(
  entities: Partial<ParsedEntities>,
  lineUserId: string
): Promise<MessageResponse> {
  const { crop, condition } = entities;

  if (!crop) {
    return {
      text: t('intent.unknown'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }

  try {
    // Map condition string to enum value
    const conditionMap: Record<string, 'excellent' | 'good' | 'normal' | 'poor' | 'critical'> = {
      excellent: 'excellent',
      good: 'good',
      normal: 'normal',
      poor: 'poor',
      critical: 'critical',
    };

    const growthCondition = condition ? conditionMap[condition] || 'normal' : 'normal';

    // Save record to database
    const fieldRecordService = getFieldRecordService();
    const result = await fieldRecordService.createGrowthRecord({
      lineUserId,
      cropName: crop,
      condition: growthCondition,
    });

    if (!result) {
      return {
        text: t('record.growth.noPlanting', { crop }),
        quickReply: QuickReplyPresets.mainMenu(),
      };
    }

    const response = t('record.growth.success', { crop });

    return {
      text: response,
      quickReply: QuickReplyPresets.mainMenu(),
    };
  } catch (error) {
    console.error('Error saving growth record:', error);

    // Fall back to response without database
    const response = t('record.growth.success', { crop });

    return {
      text: response,
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }
}

/**
 * Handles crop query action.
 * Shows the user's recorded crops with harvest predictions.
 *
 * @param lineUserId - LINE user ID
 * @returns Response with crop list
 */
async function handleQueryCrops(lineUserId: string): Promise<MessageResponse> {
  try {
    const fieldRecordService = getFieldRecordService();
    const records = await fieldRecordService.getActivePlantingRecords(lineUserId);

    if (records.length === 0) {
      return {
        text: t('query.crops.empty') + '\n\n' + t('help.recording'),
        quickReply: QuickReplyPresets.mainMenu(),
      };
    }

    // Build crop list
    const cropLines = records.map((record) => {
      let line = `• ${record.cropName} - ${record.area}${t('units.area.plots')}`;
      if (record.expectedHarvestDate) {
        line += ` (${t('query.crops.harvestDate', { date: formatDate(record.expectedHarvestDate) })})`;
      }
      return line;
    });

    const response = [t('query.crops.title'), '', ...cropLines].join('\n');

    return {
      text: response,
      quickReply: QuickReplyPresets.mainMenu(),
    };
  } catch (error) {
    console.error('Error fetching crop records:', error);

    return {
      text: t('query.crops.empty') + '\n\n' + t('help.recording'),
      quickReply: QuickReplyPresets.mainMenu(),
    };
  }
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
