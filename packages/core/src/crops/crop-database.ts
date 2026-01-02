/**
 * Crop Database
 *
 * Contains information about common crops in Taiwan, including:
 * - Growth cycle (days to harvest)
 * - Optimal growing conditions (temperature, seasons)
 * - Expected yield per plot
 * - Common pests and diseases
 *
 * Note: Crop names are stored in Traditional Chinese as they are used
 * for matching user input. Use i18n for display purposes.
 */

import type { CropInfo } from '@minori/shared';

/**
 * Crop database with common vegetables and fruits in Taiwan.
 * This is the initial version; can be migrated to a database later.
 */
export const CROPS: CropInfo[] = [
  // ===== Leafy Vegetables =====
  {
    id: 'bok-choy',
    name: '小白菜',
    aliases: ['青江菜', '湯匙菜', '小松菜', '白菜'],
    category: 'leafy',
    growth: {
      daysMin: 25,
      daysMax: 40,
      daysOptimal: 30,
      temperatureMin: 10,
      temperatureMax: 30,
      temperatureOptimal: 20,
    },
    seasons: ['spring', 'autumn', 'winter'],
    yield: { perArea: 800, variance: 0.2 },
    commonPests: ['蚜蟲', '菜青蟲', '黃條葉蚤'],
  },
  {
    id: 'water-spinach',
    name: '空心菜',
    aliases: ['蕹菜', '通菜'],
    category: 'leafy',
    growth: {
      daysMin: 25,
      daysMax: 35,
      daysOptimal: 28,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer', 'autumn'],
    yield: { perArea: 1000, variance: 0.15 },
    commonPests: ['蚜蟲', '葉蟎'],
  },
  {
    id: 'lettuce-a',
    name: 'A菜',
    aliases: ['萵苣', '大陸妹', '油麥菜'],
    category: 'leafy',
    growth: {
      daysMin: 35,
      daysMax: 50,
      daysOptimal: 40,
      temperatureMin: 15,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 600, variance: 0.2 },
    commonPests: ['蚜蟲', '薊馬'],
  },
  {
    id: 'spinach',
    name: '菠菜',
    aliases: ['波菜', '菠薐菜'],
    category: 'leafy',
    growth: {
      daysMin: 30,
      daysMax: 50,
      daysOptimal: 40,
      temperatureMin: 5,
      temperatureMax: 25,
      temperatureOptimal: 15,
    },
    seasons: ['autumn', 'winter'],
    yield: { perArea: 500, variance: 0.25 },
    commonPests: ['蚜蟲', '潛葉蠅'],
  },
  {
    id: 'cabbage',
    name: '高麗菜',
    aliases: ['甘藍', '包心菜', '捲心菜'],
    category: 'leafy',
    growth: {
      daysMin: 60,
      daysMax: 90,
      daysOptimal: 75,
      temperatureMin: 10,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 3000, variance: 0.2 },
    commonPests: ['菜青蟲', '蚜蟲', '小菜蛾'],
  },

  // ===== Root Vegetables =====
  {
    id: 'white-radish',
    name: '白蘿蔔',
    aliases: ['菜頭', '蘿蔔'],
    category: 'root',
    growth: {
      daysMin: 50,
      daysMax: 70,
      daysOptimal: 60,
      temperatureMin: 10,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter'],
    yield: { perArea: 3500, variance: 0.2 },
    commonPests: ['蚜蟲', '菜青蟲'],
  },
  {
    id: 'carrot',
    name: '紅蘿蔔',
    aliases: ['胡蘿蔔'],
    category: 'root',
    growth: {
      daysMin: 70,
      daysMax: 100,
      daysOptimal: 85,
      temperatureMin: 10,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter'],
    yield: { perArea: 2500, variance: 0.2 },
    commonPests: ['蚜蟲', '根瘤線蟲'],
  },

  // ===== Gourds and Melons =====
  {
    id: 'cucumber',
    name: '小黃瓜',
    aliases: ['黃瓜', '胡瓜'],
    category: 'gourd',
    growth: {
      daysMin: 45,
      daysMax: 60,
      daysOptimal: 50,
      temperatureMin: 18,
      temperatureMax: 32,
      temperatureOptimal: 25,
    },
    seasons: ['spring', 'summer', 'autumn'],
    yield: { perArea: 2000, variance: 0.25 },
    commonPests: ['蚜蟲', '白粉病', '瓜實蠅'],
  },
  {
    id: 'loofah',
    name: '絲瓜',
    aliases: ['菜瓜'],
    category: 'gourd',
    growth: {
      daysMin: 50,
      daysMax: 70,
      daysOptimal: 60,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer'],
    yield: { perArea: 1800, variance: 0.2 },
    commonPests: ['蚜蟲', '瓜實蠅', '白粉病'],
  },
  {
    id: 'bitter-gourd',
    name: '苦瓜',
    aliases: ['涼瓜'],
    category: 'gourd',
    growth: {
      daysMin: 55,
      daysMax: 75,
      daysOptimal: 65,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer'],
    yield: { perArea: 1500, variance: 0.25 },
    commonPests: ['蚜蟲', '瓜實蠅'],
  },

  // ===== Fruits =====
  {
    id: 'tomato',
    name: '番茄',
    aliases: ['西紅柿', '蕃茄', '柑仔蜜'],
    category: 'fruit',
    growth: {
      daysMin: 60,
      daysMax: 90,
      daysOptimal: 75,
      temperatureMin: 15,
      temperatureMax: 30,
      temperatureOptimal: 24,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 3000, variance: 0.3 },
    commonPests: ['番茄夜蛾', '白粉蝨', '晚疫病'],
  },
];

/**
 * Finds a crop by its ID.
 *
 * @param id - Crop ID (e.g., 'bok-choy')
 * @returns Crop info or undefined if not found
 */
export function getCropById(id: string): CropInfo | undefined {
  return CROPS.find((crop) => crop.id === id);
}

/**
 * Finds a crop by its name or alias.
 * Performs case-insensitive exact matching.
 *
 * @param name - Crop name in any supported language/alias
 * @returns Crop info or undefined if not found
 *
 * @example
 * ```typescript
 * const crop = findCropByName('小白菜');  // Find by name
 * const crop = findCropByName('青江菜');  // Find by alias
 * ```
 */
export function findCropByName(name: string): CropInfo | undefined {
  const normalized = name.trim().toLowerCase();
  return CROPS.find(
    (crop) =>
      crop.name.toLowerCase() === normalized ||
      crop.aliases.some((alias) => alias.toLowerCase() === normalized)
  );
}

/**
 * Searches crops by partial name match.
 * Performs case-insensitive substring matching.
 *
 * @param query - Search query
 * @returns Array of matching crops
 */
export function searchCrops(query: string): CropInfo[] {
  const normalized = query.trim().toLowerCase();
  return CROPS.filter(
    (crop) =>
      crop.name.toLowerCase().includes(normalized) ||
      crop.aliases.some((alias) => alias.toLowerCase().includes(normalized))
  );
}

/**
 * Returns all crops in the database.
 *
 * @returns Array of all crops
 */
export function getAllCrops(): CropInfo[] {
  return [...CROPS];
}

/**
 * Returns crops that can be planted in the given season.
 *
 * @param season - Season to filter by
 * @returns Array of crops suitable for the season
 */
export function getCropsBySeason(season: 'spring' | 'summer' | 'autumn' | 'winter'): CropInfo[] {
  return CROPS.filter((crop) => crop.seasons.includes(season));
}
