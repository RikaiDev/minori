/**
 * Message Handler Module
 *
 * Handles incoming webhook events from LINE and routes them
 * to appropriate handlers based on message type.
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
import { parseIntent } from '@minori/ai-engine';
import { findCropByName, predictHarvest } from '@minori/core';
import { t, formatDate } from '@minori/shared';
import type { ParsedIntent } from '@minori/shared';

/**
 * Response with optional quick reply buttons.
 */
interface MessageResponse {
  text: string;
  quickReply?: QuickReplyButton[];
}

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
    // Parse intent from text
    const intent = await parseIntent(text);

    // Execute action based on intent
    const response = await executeIntent(intent, userId);

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
 * Executes the action corresponding to the parsed intent.
 *
 * @param intent - Parsed intent from user input
 * @param _userId - LINE user ID (for future use)
 * @returns Response with text and optional quick reply buttons
 */
async function executeIntent(intent: ParsedIntent, _userId: string): Promise<MessageResponse> {
  switch (intent.action) {
    case 'record_planting':
      return handleRecordPlanting(intent);

    case 'record_harvest':
      return handleRecordHarvest(intent);

    case 'query_crops':
      return {
        text: t('query.crops.developing'),
        quickReply: QuickReplyPresets.mainMenu(),
      };

    case 'query_forecast':
      return {
        text: t('query.forecast.developing'),
        quickReply: QuickReplyPresets.mainMenu(),
      };

    case 'query_price':
      return {
        text: t('query.price.developing'),
        quickReply: QuickReplyPresets.mainMenu(),
      };

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
 * Handles planting record intent.
 *
 * @param intent - Parsed intent with planting information
 * @returns Response with text and quick reply buttons
 */
function handleRecordPlanting(intent: ParsedIntent): MessageResponse {
  const { crop, area, areaUnit, cropId } = intent.entities;

  // Ask for crop if not provided
  if (!crop) {
    return {
      text: t('record.planting.askCrop'),
      quickReply: QuickReplyPresets.commonCrops(),
    };
  }

  // Ask for area if not provided
  if (!area) {
    return {
      text: t('record.planting.askArea', { crop }),
      quickReply: QuickReplyPresets.areaUnits(),
    };
  }

  // Get crop info for prediction
  const cropInfo = cropId ? findCropByName(crop) : undefined;

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

  return {
    text: response,
    quickReply: QuickReplyPresets.afterPlanting(),
  };
}

/**
 * Handles harvest record intent.
 *
 * @param intent - Parsed intent with harvest information
 * @returns Response with text and quick reply buttons
 */
function handleRecordHarvest(intent: ParsedIntent): MessageResponse {
  const { crop, quantity, quantityUnit } = intent.entities;

  // Ask for crop if not provided
  if (!crop) {
    return {
      text: t('record.harvest.askCrop'),
      quickReply: QuickReplyPresets.commonCrops(),
    };
  }

  // Ask for quantity if not provided
  if (!quantity) {
    return {
      text: t('record.harvest.askQuantity', { crop }),
      quickReply: [
        { label: '10公斤', text: '10公斤' },
        { label: '20公斤', text: '20公斤' },
        { label: '50公斤', text: '50公斤' },
        { label: '100公斤', text: '100公斤' },
      ],
    };
  }

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
