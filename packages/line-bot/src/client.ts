/**
 * LINE Bot Client Configuration
 *
 * Provides a unified interface for LINE Messaging API operations.
 * Includes methods for sending messages, downloading media, and managing clients.
 */

import { messagingApi } from '@line/bot-sdk';

type TextMessage = messagingApi.TextMessage;
type Message = messagingApi.Message;
type ReplyMessageResponse = messagingApi.ReplyMessageResponse;
type PushMessageResponse = messagingApi.PushMessageResponse;

export interface LineConfig {
  channelSecret: string;
  channelAccessToken: string;
}

let client: messagingApi.MessagingApiClient | null = null;
let blobClient: messagingApi.MessagingApiBlobClient | null = null;

/**
 * Initializes the LINE Bot client with the provided configuration.
 * Must be called before using any other LINE client functions.
 *
 * @param config - LINE channel configuration
 */
export function initializeLineClient(config: LineConfig): void {
  client = new messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken,
  });
  blobClient = new messagingApi.MessagingApiBlobClient({
    channelAccessToken: config.channelAccessToken,
  });
}

/**
 * Gets the LINE Messaging API client.
 *
 * @throws Error if client is not initialized
 * @returns LINE Messaging API client
 */
export function getLineClient(): messagingApi.MessagingApiClient {
  if (!client) {
    throw new Error('LINE client not initialized. Call initializeLineClient first.');
  }
  return client;
}

/**
 * Gets the LINE Blob client for downloading media content.
 *
 * @throws Error if client is not initialized
 * @returns LINE Messaging API Blob client
 */
export function getLineBlobClient(): messagingApi.MessagingApiBlobClient {
  if (!blobClient) {
    throw new Error('LINE blob client not initialized. Call initializeLineClient first.');
  }
  return blobClient;
}

/**
 * Replies with a text message.
 *
 * @param replyToken - Reply token from the webhook event
 * @param text - Text message to send
 * @returns API response
 */
export async function replyText(replyToken: string, text: string): Promise<ReplyMessageResponse> {
  const message: TextMessage = {
    type: 'text',
    text,
  };
  return getLineClient().replyMessage({
    replyToken,
    messages: [message],
  });
}

/**
 * Replies with multiple messages.
 *
 * @param replyToken - Reply token from the webhook event
 * @param messages - Array of messages to send
 * @returns API response
 */
export async function replyMessages(
  replyToken: string,
  messages: Message[]
): Promise<ReplyMessageResponse> {
  return getLineClient().replyMessage({
    replyToken,
    messages,
  });
}

/**
 * Pushes messages to a user.
 *
 * @param userId - LINE user ID
 * @param messages - Array of messages to send
 * @returns API response
 */
export async function pushMessage(
  userId: string,
  messages: Message[]
): Promise<PushMessageResponse> {
  return getLineClient().pushMessage({
    to: userId,
    messages,
  });
}

/**
 * Downloads media content from a message.
 *
 * @param messageId - Message ID containing the media
 * @returns Buffer containing the media content
 */
export async function getMessageContent(messageId: string): Promise<Buffer> {
  const stream = await getLineBlobClient().getMessageContent(messageId);

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
