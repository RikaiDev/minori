/**
 * Crop Database
 *
 * Contains information about common crops in Taiwan, including:
 * - Growth cycle (days to harvest)
 * - Optimal growing conditions (temperature, seasons)
 * - Expected yield per plot
 * - Common pests and diseases
 * - Regional variations
 *
 * Note: Crop names are stored in Traditional Chinese as they are used
 * for matching user input. Use i18n for display purposes.
 */

import type { CropInfo, TaiwanRegion, Season, RegionalAdjustment } from '@minori/shared';

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
    commonDiseases: ['軟腐病', '黑斑病', '露菌病'],
    regions: [
      { region: 'south', daysAdjustment: -5, yieldMultiplier: 1.1 },
      { region: 'north', daysAdjustment: 5, seasons: ['spring', 'autumn'] },
    ],
    plantingTips: ['避免連作', '注意排水', '夏季需遮陰'],
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
    commonPests: ['蚜蟲', '葉蟎', '斜紋夜蛾'],
    commonDiseases: ['白鏽病', '炭疽病'],
    regions: [
      { region: 'south', seasons: ['spring', 'summer', 'autumn', 'winter'], yieldMultiplier: 1.2 },
    ],
    plantingTips: ['喜濕潤環境', '可水耕栽培', '採收後快速生長'],
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
    commonPests: ['蚜蟲', '薊馬', '斑潛蠅'],
    commonDiseases: ['軟腐病', '灰黴病', '菌核病'],
    plantingTips: ['涼爽季節栽培', '避免高溫', '注意通風'],
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
    commonPests: ['蚜蟲', '潛葉蠅', '夜蛾類'],
    commonDiseases: ['露菌病', '炭疽病', '病毒病'],
    regions: [{ region: 'central', notes: '高山地區全年可種' }],
    plantingTips: ['耐寒作物', '不耐高溫', '需充足日照'],
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
    commonPests: ['菜青蟲', '蚜蟲', '小菜蛾', '紋白蝶'],
    commonDiseases: ['黑腐病', '軟腐病', '根瘤病'],
    regions: [
      { region: 'central', notes: '梨山、清境等高山區為主產地', yieldMultiplier: 1.3 },
      { region: 'south', daysAdjustment: -10 },
    ],
    plantingTips: ['高山品質較佳', '注意結球期水分', '防治蟲害很重要'],
  },
  {
    id: 'chinese-cabbage',
    name: '大白菜',
    aliases: ['山東白菜', '結球白菜', '包心白菜'],
    category: 'leafy',
    growth: {
      daysMin: 55,
      daysMax: 80,
      daysOptimal: 65,
      temperatureMin: 10,
      temperatureMax: 22,
      temperatureOptimal: 15,
    },
    seasons: ['autumn', 'winter'],
    yield: { perArea: 4000, variance: 0.2 },
    commonPests: ['蚜蟲', '菜青蟲', '小菜蛾'],
    commonDiseases: ['軟腐病', '黑斑病', '病毒病'],
    plantingTips: ['秋冬栽培', '需充足水分', '結球期避免淋雨'],
  },
  {
    id: 'crown-daisy',
    name: '茼蒿',
    aliases: ['春菊', '皇帝菜', '蒿子桿'],
    category: 'leafy',
    growth: {
      daysMin: 30,
      daysMax: 45,
      daysOptimal: 35,
      temperatureMin: 10,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 500, variance: 0.2 },
    commonPests: ['蚜蟲', '潛葉蠅'],
    commonDiseases: ['灰黴病', '軟腐病'],
    plantingTips: ['火鍋季節需求大', '生長快速', '可多次採收'],
  },
  {
    id: 'chinese-kale',
    name: '芥蘭',
    aliases: ['格蘭菜', '芥藍'],
    category: 'leafy',
    growth: {
      daysMin: 50,
      daysMax: 70,
      daysOptimal: 60,
      temperatureMin: 15,
      temperatureMax: 28,
      temperatureOptimal: 20,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 700, variance: 0.2 },
    commonPests: ['蚜蟲', '菜青蟲', '小菜蛾'],
    commonDiseases: ['黑腐病', '軟腐病'],
    plantingTips: ['採收花蕾', '需肥量高', '注意蟲害防治'],
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
    commonPests: ['蚜蟲', '菜青蟲', '根蛆'],
    commonDiseases: ['軟腐病', '黑心病', '病毒病'],
    regions: [{ region: 'central', notes: '美濃蘿蔔知名', yieldMultiplier: 1.2 }],
    plantingTips: ['深耕土壤', '避免石塊', '過年需求大'],
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
    commonPests: ['蚜蟲', '根瘤線蟲', '胡蘿蔔蠅'],
    commonDiseases: ['軟腐病', '黑腐病'],
    regions: [{ region: 'central', notes: '雲林為主產地' }],
    plantingTips: ['需鬆軟土壤', '間苗很重要', '避免使用新鮮有機肥'],
  },
  {
    id: 'taro',
    name: '芋頭',
    aliases: ['芋', '芋仔'],
    category: 'root',
    growth: {
      daysMin: 180,
      daysMax: 240,
      daysOptimal: 210,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring'],
    yield: { perArea: 2000, variance: 0.25 },
    commonPests: ['斜紋夜蛾', '蚜蟲'],
    commonDiseases: ['軟腐病', '疫病'],
    regions: [
      { region: 'central', notes: '大甲芋頭知名', yieldMultiplier: 1.3 },
      { region: 'east', notes: '花蓮芋頭品質佳' },
    ],
    plantingTips: ['需水量大', '生長期長', '中秋節需求高'],
  },
  {
    id: 'sweet-potato',
    name: '地瓜',
    aliases: ['番薯', '甘藷', '蕃薯'],
    category: 'root',
    growth: {
      daysMin: 90,
      daysMax: 150,
      daysOptimal: 120,
      temperatureMin: 18,
      temperatureMax: 35,
      temperatureOptimal: 25,
    },
    seasons: ['spring', 'summer', 'autumn'],
    yield: { perArea: 2500, variance: 0.3 },
    commonPests: ['蟻象', '金龜子', '切根蟲'],
    commonDiseases: ['蔓割病', '黑斑病'],
    regions: [{ region: 'central', notes: '雲林、彰化為主產地' }],
    plantingTips: ['排水要好', '沙質土壤佳', '可作為輪作作物'],
  },
  {
    id: 'onion',
    name: '洋蔥',
    aliases: ['玉蔥', '蔥頭'],
    category: 'root',
    growth: {
      daysMin: 100,
      daysMax: 150,
      daysOptimal: 120,
      temperatureMin: 10,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter'],
    yield: { perArea: 3000, variance: 0.2 },
    commonPests: ['薊馬', '蔥蠅'],
    commonDiseases: ['紫斑病', '軟腐病', '露菌病'],
    regions: [{ region: 'south', notes: '屏東車城、恆春為主產地', yieldMultiplier: 1.2 }],
    plantingTips: ['需低溫結球', '採收後需曬乾', '儲存性佳'],
  },
  {
    id: 'garlic',
    name: '蒜頭',
    aliases: ['大蒜'],
    category: 'root',
    growth: {
      daysMin: 120,
      daysMax: 180,
      daysOptimal: 150,
      temperatureMin: 10,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn'],
    yield: { perArea: 800, variance: 0.25 },
    commonPests: ['薊馬', '蔥蠅'],
    commonDiseases: ['紫斑病', '軟腐病', '銹病'],
    regions: [{ region: 'central', notes: '雲林為主產地' }],
    plantingTips: ['需低溫春化', '蒜片繁殖', '可採收蒜苗'],
  },
  {
    id: 'ginger',
    name: '薑',
    aliases: ['生薑', '老薑', '嫩薑'],
    category: 'root',
    growth: {
      daysMin: 150,
      daysMax: 300,
      daysOptimal: 240,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring'],
    yield: { perArea: 1500, variance: 0.3 },
    commonPests: ['薑螟', '根蟎'],
    commonDiseases: ['軟腐病', '萎凋病'],
    regions: [{ region: 'south', notes: '南投、台東為主產地' }],
    plantingTips: ['需遮陰', '怕積水', '嫩薑與老薑採收期不同'],
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
    commonPests: ['蚜蟲', '瓜實蠅', '葉蟎'],
    commonDiseases: ['白粉病', '露菌病', '炭疽病'],
    plantingTips: ['需搭架', '持續採收', '注意白粉病防治'],
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
    commonPests: ['蚜蟲', '瓜實蠅', '白粉蝨'],
    commonDiseases: ['白粉病', '露菌病', '炭疽病'],
    plantingTips: ['需搭棚架', '嫩果採收', '老熟可做絲瓜絡'],
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
    commonPests: ['蚜蟲', '瓜實蠅', '薊馬'],
    commonDiseases: ['白粉病', '炭疽病'],
    plantingTips: ['需搭棚架', '白色與綠色品種', '耐熱作物'],
  },
  {
    id: 'winter-melon',
    name: '冬瓜',
    aliases: ['東瓜', '白瓜'],
    category: 'gourd',
    growth: {
      daysMin: 90,
      daysMax: 120,
      daysOptimal: 100,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer'],
    yield: { perArea: 5000, variance: 0.3 },
    commonPests: ['蚜蟲', '瓜實蠅'],
    commonDiseases: ['白粉病', '炭疽病', '蔓枯病'],
    plantingTips: ['需大空間', '果實很重需支撐', '可長期儲存'],
  },
  {
    id: 'pumpkin',
    name: '南瓜',
    aliases: ['金瓜'],
    category: 'gourd',
    growth: {
      daysMin: 80,
      daysMax: 120,
      daysOptimal: 100,
      temperatureMin: 18,
      temperatureMax: 32,
      temperatureOptimal: 25,
    },
    seasons: ['spring', 'summer'],
    yield: { perArea: 2000, variance: 0.3 },
    commonPests: ['蚜蟲', '瓜實蠅', '葉蟎'],
    commonDiseases: ['白粉病', '病毒病'],
    regions: [{ region: 'east', notes: '花蓮南瓜品質佳' }],
    plantingTips: ['需大空間', '耐旱', '儲存性佳'],
  },

  // ===== Fruits (Vegetable Fruits) =====
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
    commonPests: ['番茄夜蛾', '白粉蝨', '薊馬'],
    commonDiseases: ['晚疫病', '青枯病', '病毒病'],
    regions: [{ region: 'south', notes: '高雄美濃小番茄知名', yieldMultiplier: 1.2 }],
    plantingTips: ['需整枝', '避免淋雨', '設施栽培品質較佳'],
  },
  {
    id: 'eggplant',
    name: '茄子',
    aliases: ['矮瓜'],
    category: 'fruit',
    growth: {
      daysMin: 60,
      daysMax: 90,
      daysOptimal: 75,
      temperatureMin: 18,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer', 'autumn'],
    yield: { perArea: 2000, variance: 0.25 },
    commonPests: ['二點葉蟎', '茄螟', '薊馬'],
    commonDiseases: ['青枯病', '炭疽病', '褐紋病'],
    regions: [{ region: 'south', notes: '屏東為主產地', yieldMultiplier: 1.1 }],
    plantingTips: ['喜高溫', '需整枝', '長型與圓型品種'],
  },
  {
    id: 'bell-pepper',
    name: '甜椒',
    aliases: ['彩椒', '青椒', '大椒'],
    category: 'fruit',
    growth: {
      daysMin: 60,
      daysMax: 90,
      daysOptimal: 75,
      temperatureMin: 18,
      temperatureMax: 30,
      temperatureOptimal: 25,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 1800, variance: 0.25 },
    commonPests: ['蚜蟲', '薊馬', '二點葉蟎'],
    commonDiseases: ['疫病', '炭疽病', '病毒病'],
    regions: [{ region: 'south', notes: '設施栽培為主' }],
    plantingTips: ['設施栽培品質好', '彩椒需較長成熟期', '避免高溫'],
  },
  {
    id: 'chili-pepper',
    name: '辣椒',
    aliases: ['番椒', '朝天椒', '糯米椒'],
    category: 'fruit',
    growth: {
      daysMin: 50,
      daysMax: 80,
      daysOptimal: 65,
      temperatureMin: 18,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer', 'autumn'],
    yield: { perArea: 1000, variance: 0.3 },
    commonPests: ['蚜蟲', '薊馬', '二點葉蟎'],
    commonDiseases: ['炭疽病', '疫病', '病毒病'],
    plantingTips: ['品種多樣', '辣度與品種有關', '可乾燥保存'],
  },
  {
    id: 'okra',
    name: '秋葵',
    aliases: ['黃秋葵', '羊角豆'],
    category: 'fruit',
    growth: {
      daysMin: 50,
      daysMax: 70,
      daysOptimal: 60,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer'],
    yield: { perArea: 800, variance: 0.25 },
    commonPests: ['蚜蟲', '棉蚜', '夜蛾類'],
    commonDiseases: ['白粉病', '病毒病'],
    plantingTips: ['喜高溫', '每日採收', '嫩果口感最佳'],
  },

  // ===== Legumes =====
  {
    id: 'green-bean',
    name: '四季豆',
    aliases: ['敏豆', '菜豆'],
    category: 'legume',
    growth: {
      daysMin: 45,
      daysMax: 60,
      daysOptimal: 50,
      temperatureMin: 15,
      temperatureMax: 30,
      temperatureOptimal: 22,
    },
    seasons: ['spring', 'autumn'],
    yield: { perArea: 800, variance: 0.2 },
    commonPests: ['蚜蟲', '豆莢螟', '薊馬'],
    commonDiseases: ['炭疽病', '鏽病', '白粉病'],
    plantingTips: ['矮性免搭架', '蔓性需搭架', '避免高溫'],
  },
  {
    id: 'snow-pea',
    name: '荷蘭豆',
    aliases: ['豌豆', '碗豆'],
    category: 'legume',
    growth: {
      daysMin: 50,
      daysMax: 70,
      daysOptimal: 60,
      temperatureMin: 10,
      temperatureMax: 22,
      temperatureOptimal: 15,
    },
    seasons: ['autumn', 'winter'],
    yield: { perArea: 500, variance: 0.25 },
    commonPests: ['蚜蟲', '潛葉蠅'],
    commonDiseases: ['白粉病', '銹病'],
    plantingTips: ['涼季作物', '需搭架', '嫩莢採收'],
  },
  {
    id: 'edamame',
    name: '毛豆',
    aliases: ['黃豆', '大豆'],
    category: 'legume',
    growth: {
      daysMin: 70,
      daysMax: 100,
      daysOptimal: 85,
      temperatureMin: 18,
      temperatureMax: 32,
      temperatureOptimal: 25,
    },
    seasons: ['spring', 'summer'],
    yield: { perArea: 600, variance: 0.25 },
    commonPests: ['蚜蟲', '豆莢螟', '夜蛾類'],
    commonDiseases: ['銹病', '紫斑病'],
    regions: [{ region: 'south', notes: '高雄、屏東為主產地' }],
    plantingTips: ['鮮食需及時採收', '可固氮改良土壤', '輪作效果好'],
  },
  {
    id: 'long-bean',
    name: '長豇豆',
    aliases: ['菜豆', '豆角'],
    category: 'legume',
    growth: {
      daysMin: 50,
      daysMax: 70,
      daysOptimal: 60,
      temperatureMin: 20,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer', 'autumn'],
    yield: { perArea: 1000, variance: 0.2 },
    commonPests: ['蚜蟲', '豆莢螟', '薊馬'],
    commonDiseases: ['銹病', '炭疽病'],
    plantingTips: ['需搭架', '連續採收', '夏季主力蔬菜'],
  },

  // ===== Herbs =====
  {
    id: 'green-onion',
    name: '蔥',
    aliases: ['青蔥', '大蔥'],
    category: 'herb',
    growth: {
      daysMin: 60,
      daysMax: 90,
      daysOptimal: 75,
      temperatureMin: 10,
      temperatureMax: 28,
      temperatureOptimal: 20,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 1000, variance: 0.2 },
    commonPests: ['薊馬', '蔥蠅', '潛葉蠅'],
    commonDiseases: ['紫斑病', '軟腐病', '銹病'],
    regions: [{ region: 'central', notes: '宜蘭三星蔥最知名', yieldMultiplier: 1.3 }],
    plantingTips: ['分蘗繁殖', '需培土', '採收後再生快'],
  },
  {
    id: 'coriander',
    name: '香菜',
    aliases: ['芫荽', '胡荽'],
    category: 'herb',
    growth: {
      daysMin: 30,
      daysMax: 50,
      daysOptimal: 40,
      temperatureMin: 10,
      temperatureMax: 25,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter', 'spring'],
    yield: { perArea: 300, variance: 0.3 },
    commonPests: ['蚜蟲'],
    commonDiseases: ['軟腐病'],
    plantingTips: ['涼季栽培', '發芽慢', '可多次播種'],
  },
  {
    id: 'basil',
    name: '九層塔',
    aliases: ['羅勒', '金不換'],
    category: 'herb',
    growth: {
      daysMin: 30,
      daysMax: 45,
      daysOptimal: 35,
      temperatureMin: 18,
      temperatureMax: 35,
      temperatureOptimal: 28,
    },
    seasons: ['spring', 'summer', 'autumn'],
    yield: { perArea: 400, variance: 0.25 },
    commonPests: ['蚜蟲', '薊馬'],
    commonDiseases: ['立枯病'],
    plantingTips: ['喜溫暖', '摘心促分枝', '香氣濃郁'],
  },
  {
    id: 'chives',
    name: '韭菜',
    aliases: ['韭黃'],
    category: 'herb',
    growth: {
      daysMin: 30,
      daysMax: 45,
      daysOptimal: 35,
      temperatureMin: 12,
      temperatureMax: 28,
      temperatureOptimal: 20,
    },
    seasons: ['spring', 'autumn', 'winter'],
    yield: { perArea: 600, variance: 0.2 },
    commonPests: ['薊馬', '韭蛆'],
    commonDiseases: ['灰黴病', '疫病'],
    regions: [{ region: 'central', notes: '彰化為主產地' }],
    plantingTips: ['多年生', '可多次採收', '遮光成韭黃'],
  },
  {
    id: 'celery',
    name: '芹菜',
    aliases: ['西洋芹', '西芹'],
    category: 'herb',
    growth: {
      daysMin: 80,
      daysMax: 120,
      daysOptimal: 100,
      temperatureMin: 12,
      temperatureMax: 22,
      temperatureOptimal: 18,
    },
    seasons: ['autumn', 'winter'],
    yield: { perArea: 2000, variance: 0.2 },
    commonPests: ['蚜蟲', '潛葉蠅'],
    commonDiseases: ['軟腐病', '斑點病'],
    plantingTips: ['涼季作物', '需充足水分', '培土可軟化'],
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
export function getCropsBySeason(season: Season): CropInfo[] {
  return CROPS.filter((crop) => crop.seasons.includes(season));
}

/**
 * Returns crops by category.
 *
 * @param category - Crop category to filter by
 * @returns Array of crops in the category
 */
export function getCropsByCategory(
  category: 'leafy' | 'root' | 'gourd' | 'fruit' | 'grain' | 'herb' | 'legume'
): CropInfo[] {
  return CROPS.filter((crop) => crop.category === category);
}

/**
 * Gets regional adjustment for a crop in a specific region.
 *
 * @param cropId - Crop ID
 * @param region - Taiwan region
 * @returns Regional adjustment or undefined if no specific adjustment exists
 */
export function getRegionalAdjustment(
  cropId: string,
  region: TaiwanRegion
): RegionalAdjustment | undefined {
  const crop = getCropById(cropId);
  if (!crop?.regions) return undefined;
  return crop.regions.find((r) => r.region === region);
}

/**
 * Calculates adjusted growth days for a crop in a specific region.
 *
 * @param cropId - Crop ID
 * @param region - Taiwan region
 * @returns Adjusted growth parameters or original if no adjustment
 */
export function getAdjustedGrowthDays(
  cropId: string,
  region: TaiwanRegion
): { daysMin: number; daysMax: number; daysOptimal: number } | undefined {
  const crop = getCropById(cropId);
  if (!crop) return undefined;

  const adjustment = getRegionalAdjustment(cropId, region);
  const daysAdjustment = adjustment?.daysAdjustment ?? 0;

  return {
    daysMin: crop.growth.daysMin + daysAdjustment,
    daysMax: crop.growth.daysMax + daysAdjustment,
    daysOptimal: crop.growth.daysOptimal + daysAdjustment,
  };
}

/**
 * Gets crops suitable for a specific region and season.
 *
 * @param region - Taiwan region
 * @param season - Season
 * @returns Array of crops suitable for the region and season
 */
export function getCropsForRegionAndSeason(region: TaiwanRegion, season: Season): CropInfo[] {
  return CROPS.filter((crop) => {
    // Check for regional season override
    const regionalAdj = crop.regions?.find((r) => r.region === region);
    const applicableSeasons = regionalAdj?.seasons ?? crop.seasons;
    return applicableSeasons.includes(season);
  });
}
