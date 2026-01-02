/**
 * Image Message Handler
 *
 * Handles image messages from users.
 * Will eventually support crop recognition using Vision AI.
 */

import type { webhook } from '@line/bot-sdk';

type MessageEvent = webhook.MessageEvent;
type ImageMessageContent = webhook.ImageMessageContent;
import { replyText } from '../client';
import { t } from '@minori/shared';

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

  // TODO: Implement image recognition
  // 1. Download image
  // 2. Use Vision AI to recognize crop
  // 3. Return recognition result

  await replyText(
    replyToken,
    t('photo.received') + '\n\n' + t('photo.developing')
  );
}
