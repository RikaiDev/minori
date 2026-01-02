/**
 * Audio Message Handler
 *
 * Handles voice messages from users by:
 * 1. Downloading the audio content
 * 2. Transcribing using Whisper
 * 3. Parsing the intent
 * 4. Responding with the result
 */

import type { webhook } from '@line/bot-sdk';

type MessageEvent = webhook.MessageEvent;
type AudioMessageContent = webhook.AudioMessageContent;
import { getMessageContent, replyText } from '../client';
import { transcribe, parseIntent } from '@minori/ai-engine';
import { t } from '@minori/shared';

/**
 * Handles audio messages from users.
 *
 * @param event - Message event with audio content
 * @param replyToken - Reply token for responding
 */
export async function handleAudioMessage(
  event: MessageEvent & { message: AudioMessageContent },
  replyToken: string
): Promise<void> {
  const userId = event.source?.userId;

  if (!userId) {
    return;
  }

  try {
    // 1. Download audio file
    const audioBuffer = await getMessageContent(event.message.id);

    // 2. Transcribe to text
    const transcription = await transcribe({
      audioBuffer,
      language: 'zh',
    });

    if (!transcription.text.trim()) {
      await replyText(replyToken, t('voice.notClear'));
      return;
    }

    // 3. Parse intent
    const intent = await parseIntent(transcription.text);

    // 4. Build response (show recognized text + action result)
    let response = t('voice.recognized', { text: transcription.text }) + '\n\n';

    // Add action-specific response
    switch (intent.action) {
      case 'record_planting': {
        const { crop, area, areaUnit } = intent.entities;
        if (crop && area) {
          response += t('record.planting.success', {
            crop,
            area,
            unit: areaUnit || t('units.area.plots'),
          });
        } else if (crop) {
          response += t('record.planting.askArea', { crop });
        } else {
          response += t('record.planting.askCrop');
        }
        break;
      }
      case 'record_harvest': {
        const { crop, quantity, quantityUnit } = intent.entities;
        if (crop && quantity) {
          response += t('record.harvest.success', {
            crop,
            quantity,
            unit: quantityUnit || t('units.weight.kg'),
          });
        } else if (crop) {
          response += t('record.harvest.askQuantity', { crop });
        } else {
          response += t('record.harvest.askCrop');
        }
        break;
      }
      default:
        response += t('intent.unknown');
    }

    await replyText(replyToken, response);
  } catch (error) {
    console.error('Error processing audio message:', error);
    await replyText(replyToken, t('voice.error'));
  }
}
