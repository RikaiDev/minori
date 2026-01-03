/**
 * LINE Notification Delivery
 *
 * Provides functions for delivering notifications via LINE push messages.
 * Integrates with the notification service in @minori/core.
 */

import type { messagingApi } from '@line/bot-sdk';
import { getLineClient } from './client';

type TextMessage = messagingApi.TextMessage;
type FlexMessage = messagingApi.FlexMessage;
type FlexBubble = messagingApi.FlexBubble;

/**
 * Result of a LINE push notification.
 */
export interface LinePushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Priority-based styling for notification bubbles.
 */
const PRIORITY_COLORS: Record<string, string> = {
  low: '#888888',
  medium: '#0066CC',
  high: '#FF8800',
  urgent: '#FF0000',
};

/**
 * Sends a simple text notification via LINE push message.
 *
 * @param lineUserId - LINE user ID to send to
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional additional data
 * @returns Result indicating success or failure
 */
export async function sendNotificationPush(
  lineUserId: string,
  title: string,
  body: string,
  _data?: Record<string, unknown>
): Promise<LinePushResult> {
  try {
    const client = getLineClient();

    const message: TextMessage = {
      type: 'text',
      text: `${title}\n\n${body}`,
    };

    const response = await client.pushMessage({
      to: lineUserId,
      messages: [message],
    });

    return {
      success: true,
      messageId: response.sentMessages?.[0]?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send LINE push notification:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sends a rich flex message notification via LINE push message.
 *
 * @param lineUserId - LINE user ID to send to
 * @param title - Notification title
 * @param body - Notification body
 * @param priority - Notification priority for styling
 * @param data - Optional additional data
 * @returns Result indicating success or failure
 */
export async function sendRichNotificationPush(
  lineUserId: string,
  title: string,
  body: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  _data?: Record<string, unknown>
): Promise<LinePushResult> {
  try {
    const client = getLineClient();

    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'lg',
            color: PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium,
            wrap: true,
          },
        ],
        paddingBottom: 'sm',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: body,
            size: 'sm',
            color: '#444444',
            wrap: true,
          },
        ],
        paddingTop: 'sm',
      },
    };

    const message: FlexMessage = {
      type: 'flex',
      altText: `${title}: ${body}`,
      contents: bubble,
    };

    const response = await client.pushMessage({
      to: lineUserId,
      messages: [message],
    });

    return {
      success: true,
      messageId: response.sentMessages?.[0]?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to send LINE rich notification:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Sends a batch of notifications to multiple users.
 *
 * @param notifications - Array of notifications to send
 * @returns Array of results
 */
export async function sendBatchNotifications(
  notifications: Array<{
    lineUserId: string;
    title: string;
    body: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    data?: Record<string, unknown>;
  }>
): Promise<LinePushResult[]> {
  const results: LinePushResult[] = [];

  for (const notification of notifications) {
    const result = await sendRichNotificationPush(
      notification.lineUserId,
      notification.title,
      notification.body,
      notification.priority ?? 'medium',
      notification.data
    );
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return results;
}

/**
 * Creates a notification sender function compatible with NotificationService config.
 * Use this to integrate LINE delivery with the notification service.
 *
 * @returns Function that can be passed to NotificationServiceConfig.sendLinePush
 */
export function createLinePushSender(): (
  lineUserId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) => Promise<{ success: boolean; messageId?: string; error?: string }> {
  return async (lineUserId, title, body, data) => {
    return sendRichNotificationPush(lineUserId, title, body, 'medium', data);
  };
}
