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
import { replyText } from '../client';
import { parseIntent } from '@minori/ai-engine';
import { findCropByName, predictHarvest } from '@minori/core';
import { t, formatDate } from '@minori/shared';
import type { ParsedIntent } from '@minori/shared';

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

    // Reply to user
    await replyText(replyToken, response);
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
 * @returns Response message to send to user
 */
async function executeIntent(intent: ParsedIntent, _userId: string): Promise<string> {
  switch (intent.action) {
    case 'record_planting':
      return handleRecordPlanting(intent);

    case 'record_harvest':
      return handleRecordHarvest(intent);

    case 'query_crops':
      return t('query.crops.developing');

    case 'query_forecast':
      return t('query.forecast.developing');

    case 'query_price':
      return t('query.price.developing');

    case 'confirm':
      return t('intent.confirmed');

    case 'cancel':
      return t('intent.cancelled');

    case 'help':
      return getHelpMessage();

    case 'unknown':
    default:
      return t('intent.unknown');
  }
}

/**
 * Handles planting record intent.
 *
 * @param intent - Parsed intent with planting information
 * @returns Response message
 */
function handleRecordPlanting(intent: ParsedIntent): string {
  const { crop, area, areaUnit, cropId } = intent.entities;

  if (!crop) {
    return t('record.planting.askCrop');
  }
  if (!area) {
    return t('record.planting.askArea', { crop });
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

  return response;
}

/**
 * Handles harvest record intent.
 *
 * @param intent - Parsed intent with harvest information
 * @returns Response message
 */
function handleRecordHarvest(intent: ParsedIntent): string {
  const { crop, quantity, quantityUnit } = intent.entities;

  if (!crop) {
    return t('record.harvest.askCrop');
  }
  if (!quantity) {
    return t('record.harvest.askQuantity', { crop });
  }

  let response = t('record.harvest.success', {
    crop,
    quantity,
    unit: quantityUnit || t('units.weight.kg'),
  });

  response += '\n\n' + t('record.harvest.notifyCooperative');

  return response;
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
