/**
 * Rich Menu Configuration
 *
 * Provides utilities for creating and managing LINE rich menus.
 * Rich menus are persistent menus displayed at the bottom of LINE chats.
 */

import type { messagingApi } from '@line/bot-sdk';
import { getLineClient, getLineBlobClient } from './client';

type RichMenuRequest = messagingApi.RichMenuRequest;
type RichMenuResponse = messagingApi.RichMenuResponse;
type RichMenuArea = messagingApi.RichMenuArea;
type RichMenuSize = messagingApi.RichMenuSize;
type Action = messagingApi.Action;

/**
 * Rich menu area configuration with action.
 */
export interface RichMenuAreaConfig {
  /** X coordinate of the area (from left) */
  x: number;
  /** Y coordinate of the area (from top) */
  y: number;
  /** Width of the area */
  width: number;
  /** Height of the area */
  height: number;
  /** Action to perform when area is tapped */
  action: {
    /** Action type (message, uri, postback) */
    type: 'message' | 'uri' | 'postback';
    /** Label for the action */
    label: string;
    /** Text to send (for message type) or URL (for uri type) */
    text?: string;
    /** URI for uri type actions */
    uri?: string;
    /** Data for postback actions */
    data?: string;
  };
}

/**
 * Rich menu configuration.
 */
export interface RichMenuConfig {
  /** Name of the rich menu (for management) */
  name: string;
  /** Chat bar text (shown when menu is collapsed) */
  chatBarText: string;
  /** Whether the menu is open by default */
  selected?: boolean;
  /** Size of the rich menu */
  size: {
    width: 2500 | 1200;
    height: 1686 | 843 | 810;
  };
  /** Areas and their actions */
  areas: RichMenuAreaConfig[];
}

/**
 * Converts RichMenuAreaConfig to LINE API format.
 */
function convertArea(area: RichMenuAreaConfig): RichMenuArea {
  let action: Action;

  switch (area.action.type) {
    case 'message':
      action = {
        type: 'message',
        label: area.action.label,
        text: area.action.text || area.action.label,
      };
      break;
    case 'uri':
      action = {
        type: 'uri',
        label: area.action.label,
        uri: area.action.uri || '',
      };
      break;
    case 'postback':
      action = {
        type: 'postback',
        label: area.action.label,
        data: area.action.data || '',
      };
      break;
    default:
      action = {
        type: 'message',
        label: area.action.label,
        text: area.action.label,
      };
  }

  return {
    bounds: {
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
    },
    action,
  };
}

/**
 * Creates a rich menu from configuration.
 *
 * @param config - Rich menu configuration
 * @returns Rich menu ID
 */
export async function createRichMenu(config: RichMenuConfig): Promise<string> {
  const request: RichMenuRequest = {
    name: config.name,
    chatBarText: config.chatBarText,
    selected: config.selected ?? false,
    size: config.size as RichMenuSize,
    areas: config.areas.map(convertArea),
  };

  const response = await getLineClient().createRichMenu(request);
  return response.richMenuId;
}

/**
 * Uploads an image for a rich menu.
 *
 * @param richMenuId - ID of the rich menu
 * @param imageBuffer - Image data as Buffer (JPEG or PNG, max 1MB)
 * @param contentType - Image MIME type
 */
export async function uploadRichMenuImage(
  richMenuId: string,
  imageBuffer: Buffer,
  contentType: 'image/jpeg' | 'image/png' = 'image/png'
): Promise<void> {
  const blob = new Blob([imageBuffer], { type: contentType });
  await getLineBlobClient().setRichMenuImage(richMenuId, blob);
}

/**
 * Links a rich menu to a user.
 *
 * @param userId - LINE user ID
 * @param richMenuId - Rich menu ID
 */
export async function linkRichMenuToUser(userId: string, richMenuId: string): Promise<void> {
  await getLineClient().linkRichMenuIdToUser(userId, richMenuId);
}

/**
 * Unlinks a rich menu from a user.
 *
 * @param userId - LINE user ID
 */
export async function unlinkRichMenuFromUser(userId: string): Promise<void> {
  await getLineClient().unlinkRichMenuIdFromUser(userId);
}

/**
 * Sets the default rich menu for all users.
 *
 * @param richMenuId - Rich menu ID
 */
export async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  await getLineClient().setDefaultRichMenu(richMenuId);
}

/**
 * Gets the default rich menu ID.
 *
 * @returns Default rich menu ID or null if not set
 */
export async function getDefaultRichMenu(): Promise<string | null> {
  try {
    const response = await getLineClient().getDefaultRichMenuId();
    return response.richMenuId || null;
  } catch {
    return null;
  }
}

/**
 * Deletes a rich menu.
 *
 * @param richMenuId - Rich menu ID to delete
 */
export async function deleteRichMenu(richMenuId: string): Promise<void> {
  await getLineClient().deleteRichMenu(richMenuId);
}

/**
 * Lists all rich menus.
 *
 * @returns Array of rich menu responses
 */
export async function listRichMenus(): Promise<RichMenuResponse[]> {
  const response = await getLineClient().getRichMenuList();
  return response.richmenus;
}

/**
 * Default rich menu configuration for the agricultural app.
 * Uses a 2500x1686 layout with 6 areas (2 rows x 3 columns).
 */
export const DefaultRichMenuConfig: RichMenuConfig = {
  name: 'minori-main-menu',
  chatBarText: '開啟選單',
  selected: true,
  size: {
    width: 2500,
    height: 1686,
  },
  areas: [
    // Top row
    {
      x: 0,
      y: 0,
      width: 833,
      height: 843,
      action: {
        type: 'message',
        label: '記錄播種',
        text: '記錄播種',
      },
    },
    {
      x: 833,
      y: 0,
      width: 834,
      height: 843,
      action: {
        type: 'message',
        label: '記錄採收',
        text: '記錄採收',
      },
    },
    {
      x: 1667,
      y: 0,
      width: 833,
      height: 843,
      action: {
        type: 'message',
        label: '查詢價格',
        text: '查詢價格',
      },
    },
    // Bottom row
    {
      x: 0,
      y: 843,
      width: 833,
      height: 843,
      action: {
        type: 'message',
        label: '天氣預報',
        text: '查詢天氣',
      },
    },
    {
      x: 833,
      y: 843,
      width: 834,
      height: 843,
      action: {
        type: 'message',
        label: '我的田地',
        text: '查看田地',
      },
    },
    {
      x: 1667,
      y: 843,
      width: 833,
      height: 843,
      action: {
        type: 'message',
        label: '說明',
        text: '說明',
      },
    },
  ],
};

/**
 * Compact rich menu configuration (single row).
 * Uses a 2500x843 layout with 4 areas.
 */
export const CompactRichMenuConfig: RichMenuConfig = {
  name: 'minori-compact-menu',
  chatBarText: '開啟選單',
  selected: false,
  size: {
    width: 2500,
    height: 843,
  },
  areas: [
    {
      x: 0,
      y: 0,
      width: 625,
      height: 843,
      action: {
        type: 'message',
        label: '記錄',
        text: '記錄播種',
      },
    },
    {
      x: 625,
      y: 0,
      width: 625,
      height: 843,
      action: {
        type: 'message',
        label: '採收',
        text: '記錄採收',
      },
    },
    {
      x: 1250,
      y: 0,
      width: 625,
      height: 843,
      action: {
        type: 'message',
        label: '價格',
        text: '查詢價格',
      },
    },
    {
      x: 1875,
      y: 0,
      width: 625,
      height: 843,
      action: {
        type: 'message',
        label: '天氣',
        text: '查詢天氣',
      },
    },
  ],
};

/**
 * Sets up the default rich menu for the app.
 * Creates the menu if it doesn't exist and sets it as default.
 *
 * @returns Rich menu ID
 */
export async function setupDefaultRichMenu(): Promise<string> {
  // Check if our menu already exists
  const existingMenus = await listRichMenus();
  const existingMenu = existingMenus.find((m) => m.name === DefaultRichMenuConfig.name);

  if (existingMenu) {
    // Use existing menu
    await setDefaultRichMenu(existingMenu.richMenuId);
    return existingMenu.richMenuId;
  }

  // Create new menu
  const richMenuId = await createRichMenu(DefaultRichMenuConfig);

  // Note: You need to upload a menu image separately using uploadRichMenuImage()
  // The image should be a 2500x1686 PNG or JPEG

  // Set as default
  await setDefaultRichMenu(richMenuId);

  return richMenuId;
}
