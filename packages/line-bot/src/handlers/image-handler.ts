/**
 * Image Message Handler
 *
 * Handles image messages from users.
 * Supports crop recognition using GPT-4 Vision.
 */

import type { webhook } from '@line/bot-sdk';

type MessageEvent = webhook.MessageEvent;
type ImageMessageContent = webhook.ImageMessageContent;
import { replyText, replyWithQuickReply, QuickReplyPresets } from '../client';
import { t, formatDate } from '@minori/shared';
import {
  identifyCrop,
  downloadLineImage,
  isReliableIdentification,
  isUnrecognized,
  CropIdentificationError,
} from '@minori/ai-engine';
import { predictHarvest } from '@minori/core';

/**
 * Gets the LINE channel access token from environment.
 */
function getChannelAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  }
  return token;
}

/**
 * Handles image messages from users.
 *
 * @param event - Message event with image content
 * @param replyToken - Reply token for responding
 */
export async function handleImageMessage(
  event: MessageEvent & { message: ImageMessageContent },
  replyToken: string
): Promise<void> {
  const userId = event.source?.userId;

  if (!userId) {
    return;
  }

  const messageId = event.message.id;

  try {
    // Download the image from LINE
    const channelAccessToken = getChannelAccessToken();
    const imageData = await downloadLineImage(messageId, channelAccessToken);

    // Identify the crop using Vision AI
    const result = await identifyCrop({
      image: imageData,
      detectGrowthStage: true,
      detectHealth: true,
    });

    // Handle unrecognized images
    if (isUnrecognized(result)) {
      await replyText(replyToken, t('photo.unrecognized') + '\n\n' + t('photo.tips'));
      return;
    }

    // Handle low confidence identification
    if (!isReliableIdentification(result)) {
      const cropName = result.identifiedName ?? t('photo.unknownCrop');
      let response = t('photo.lowConfidence', { crop: cropName });

      if (result.alternatives && result.alternatives.length > 0) {
        response += '\n\n' + t('photo.alternatives');
        for (const alt of result.alternatives.slice(0, 3)) {
          response += `\n• ${alt.name} (${Math.round(alt.confidence * 100)}%)`;
        }
      }

      await replyWithQuickReply(replyToken, response, QuickReplyPresets.commonCrops());
      return;
    }

    // Build response for reliable identification
    const identifiedCropName = result.identifiedName ?? t('photo.unknownCrop');
    let response = t('photo.identified', {
      crop: identifiedCropName,
      confidence: Math.round(result.confidence * 100),
    });

    // Add growth stage info
    if (result.growthStage && result.growthStage !== 'unknown') {
      response +=
        '\n\n' + t('photo.growthStage', { stage: t(`growthStage.${result.growthStage}`) });
    }

    // Add health status info
    if (result.healthStatus && result.healthStatus !== 'unknown') {
      response +=
        '\n' + t('photo.healthStatus', { status: t(`healthStatus.${result.healthStatus}`) });
    }

    // Add observations
    if (result.observations) {
      response += '\n\n' + result.observations;
    }

    // Add harvest prediction if crop is in database
    if (result.crop) {
      const prediction = predictHarvest(result.crop, new Date());
      response +=
        '\n\n' +
        t('photo.harvestPrediction', {
          date: formatDate(prediction.predictions.likely),
        });
    }

    // Suggest recording the planting
    response += '\n\n' + t('photo.recordSuggestion');

    await replyWithQuickReply(replyToken, response, [
      {
        label: t('action.recordPlanting'),
        text: t('record.plantingPrompt', { crop: identifiedCropName }),
      },
      {
        label: t('action.recordGrowth'),
        text: t('record.growthPrompt', { crop: identifiedCropName }),
      },
      ...QuickReplyPresets.mainMenu().slice(0, 2),
    ]);
  } catch (error) {
    console.error('Error processing image:', error);

    if (error instanceof CropIdentificationError) {
      switch (error.code) {
        case 'INVALID_IMAGE':
          await replyText(replyToken, t('photo.invalidImage'));
          break;
        case 'RATE_LIMITED':
          await replyText(replyToken, t('photo.rateLimited'));
          break;
        case 'TIMEOUT':
          await replyText(replyToken, t('photo.timeout'));
          break;
        default:
          await replyText(replyToken, t('photo.error'));
      }
    } else {
      // Generic error response
      await replyText(replyToken, t('photo.received') + '\n\n' + t('photo.developing'));
    }
  }
}
