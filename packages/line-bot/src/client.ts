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
type QuickReply = messagingApi.QuickReply;
type QuickReplyItem = messagingApi.QuickReplyItem;
type Action = messagingApi.Action;

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

/**
 * Quick reply button configuration.
 */
export interface QuickReplyButton {
  /** Label displayed on the button */
  label: string;
  /** Text sent when button is pressed (defaults to label) */
  text?: string;
  /** Optional image URL for the button */
  imageUrl?: string;
}

/**
 * Creates quick reply items from button configurations.
 *
 * @param buttons - Array of button configurations
 * @returns Quick reply object for use in messages
 */
export function createQuickReply(buttons: QuickReplyButton[]): QuickReply {
  const items: QuickReplyItem[] = buttons.map((button) => ({
    type: 'action',
    imageUrl: button.imageUrl,
    action: {
      type: 'message',
      label: button.label.substring(0, 20), // LINE limit: 20 chars
      text: button.text || button.label,
    } as Action,
  }));

  return { items };
}

/**
 * Replies with a text message and quick reply buttons.
 *
 * @param replyToken - Reply token from the webhook event
 * @param text - Text message to send
 * @param buttons - Quick reply button configurations
 * @returns API response
 */
export async function replyWithQuickReply(
  replyToken: string,
  text: string,
  buttons: QuickReplyButton[]
): Promise<ReplyMessageResponse> {
  const message: TextMessage = {
    type: 'text',
    text,
    quickReply: createQuickReply(buttons),
  };
  return getLineClient().replyMessage({
    replyToken,
    messages: [message],
  });
}

/**
 * Common quick reply button sets for the agricultural app.
 */
export const QuickReplyPresets = {
  /** Confirmation buttons */
  confirm: (): QuickReplyButton[] => [
    { label: '確認', text: '確認' },
    { label: '取消', text: '取消' },
  ],

  /** Main menu options */
  mainMenu: (): QuickReplyButton[] => [
    { label: '記錄播種', text: '記錄播種' },
    { label: '記錄採收', text: '記錄採收' },
    { label: '查詢價格', text: '查詢價格' },
    { label: '天氣預報', text: '查詢天氣' },
  ],

  /** After recording planting */
  afterPlanting: (): QuickReplyButton[] => [
    { label: '查看預測', text: '查看採收預測' },
    { label: '記錄更多', text: '記錄播種' },
    { label: '回主選單', text: '主選單' },
  ],

  /** After recording harvest */
  afterHarvest: (): QuickReplyButton[] => [
    { label: '查詢價格', text: '查詢價格' },
    { label: '通知合作社', text: '通知合作社' },
    { label: '回主選單', text: '主選單' },
  ],

  /** Common crops for quick selection */
  commonCrops: (): QuickReplyButton[] => [
    { label: '小白菜', text: '小白菜' },
    { label: '青江菜', text: '青江菜' },
    { label: '空心菜', text: '空心菜' },
    { label: '番茄', text: '番茄' },
  ],

  /** Area units */
  areaUnits: (): QuickReplyButton[] => [
    { label: '1分地', text: '1分地' },
    { label: '2分地', text: '2分地' },
    { label: '3分地', text: '3分地' },
    { label: '半甲地', text: '半甲地' },
  ],

  /** Help and cancel */
  helpCancel: (): QuickReplyButton[] => [
    { label: '說明', text: '說明' },
    { label: '取消', text: '取消' },
  ],
};
