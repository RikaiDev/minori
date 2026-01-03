/**
 * Unit tests for Rich Menu configuration.
 */

import { describe, expect, test } from 'bun:test';
import {
  DefaultRichMenuConfig,
  CompactRichMenuConfig,
  type RichMenuConfig,
  type RichMenuAreaConfig,
} from './rich-menu';

describe('DefaultRichMenuConfig', () => {
  test('has correct name', () => {
    expect(DefaultRichMenuConfig.name).toBe('minori-main-menu');
  });

  test('has correct chat bar text', () => {
    expect(DefaultRichMenuConfig.chatBarText).toBe('開啟選單');
  });

  test('is selected by default', () => {
    expect(DefaultRichMenuConfig.selected).toBe(true);
  });

  test('has correct size (2500x1686)', () => {
    expect(DefaultRichMenuConfig.size.width).toBe(2500);
    expect(DefaultRichMenuConfig.size.height).toBe(1686);
  });

  test('has 6 areas (2 rows x 3 columns)', () => {
    expect(DefaultRichMenuConfig.areas.length).toBe(6);
  });

  test('first row areas cover top half', () => {
    const topAreas = DefaultRichMenuConfig.areas.filter((a) => a.y === 0);
    expect(topAreas.length).toBe(3);

    // Total width should be 2500
    const totalWidth = topAreas.reduce((sum, a) => sum + a.width, 0);
    expect(totalWidth).toBe(2500);

    // All should have height 843 (half of 1686)
    topAreas.forEach((area) => {
      expect(area.height).toBe(843);
    });
  });

  test('second row areas cover bottom half', () => {
    const bottomAreas = DefaultRichMenuConfig.areas.filter((a) => a.y === 843);
    expect(bottomAreas.length).toBe(3);

    // Total width should be 2500
    const totalWidth = bottomAreas.reduce((sum, a) => sum + a.width, 0);
    expect(totalWidth).toBe(2500);

    // All should have height 843
    bottomAreas.forEach((area) => {
      expect(area.height).toBe(843);
    });
  });

  test('has record planting button', () => {
    const area = DefaultRichMenuConfig.areas.find((a) => a.action.label === '記錄播種');
    expect(area).toBeDefined();
    expect(area!.action.type).toBe('message');
    expect(area!.action.text).toBe('記錄播種');
  });

  test('has record harvest button', () => {
    const area = DefaultRichMenuConfig.areas.find((a) => a.action.label === '記錄採收');
    expect(area).toBeDefined();
    expect(area!.action.type).toBe('message');
    expect(area!.action.text).toBe('記錄採收');
  });

  test('has price query button', () => {
    const area = DefaultRichMenuConfig.areas.find((a) => a.action.label === '查詢價格');
    expect(area).toBeDefined();
    expect(area!.action.text).toBe('查詢價格');
  });

  test('has weather forecast button', () => {
    const area = DefaultRichMenuConfig.areas.find((a) => a.action.label === '天氣預報');
    expect(area).toBeDefined();
    expect(area!.action.text).toBe('查詢天氣');
  });

  test('has my fields button', () => {
    const area = DefaultRichMenuConfig.areas.find((a) => a.action.label === '我的田地');
    expect(area).toBeDefined();
    expect(area!.action.text).toBe('查看田地');
  });

  test('has help button', () => {
    const area = DefaultRichMenuConfig.areas.find((a) => a.action.label === '說明');
    expect(area).toBeDefined();
    expect(area!.action.text).toBe('說明');
  });
});

describe('CompactRichMenuConfig', () => {
  test('has correct name', () => {
    expect(CompactRichMenuConfig.name).toBe('minori-compact-menu');
  });

  test('is not selected by default', () => {
    expect(CompactRichMenuConfig.selected).toBe(false);
  });

  test('has correct size (2500x843)', () => {
    expect(CompactRichMenuConfig.size.width).toBe(2500);
    expect(CompactRichMenuConfig.size.height).toBe(843);
  });

  test('has 4 areas (single row)', () => {
    expect(CompactRichMenuConfig.areas.length).toBe(4);
  });

  test('all areas have same height', () => {
    const heights = CompactRichMenuConfig.areas.map((a) => a.height);
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBe(843);
  });

  test('areas cover full width', () => {
    const totalWidth = CompactRichMenuConfig.areas.reduce((sum, a) => sum + a.width, 0);
    expect(totalWidth).toBe(2500);
  });
});

describe('RichMenuAreaConfig structure', () => {
  test('message action has required fields', () => {
    const messageArea: RichMenuAreaConfig = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      action: {
        type: 'message',
        label: 'Test',
        text: 'test message',
      },
    };

    expect(messageArea.action.type).toBe('message');
    expect(messageArea.action.label).toBe('Test');
    expect(messageArea.action.text).toBe('test message');
  });

  test('uri action has uri field', () => {
    const uriArea: RichMenuAreaConfig = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      action: {
        type: 'uri',
        label: 'Website',
        uri: 'https://example.com',
      },
    };

    expect(uriArea.action.type).toBe('uri');
    expect(uriArea.action.uri).toBe('https://example.com');
  });

  test('postback action has data field', () => {
    const postbackArea: RichMenuAreaConfig = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      action: {
        type: 'postback',
        label: 'Action',
        data: 'action=test',
      },
    };

    expect(postbackArea.action.type).toBe('postback');
    expect(postbackArea.action.data).toBe('action=test');
  });
});

describe('RichMenuConfig structure', () => {
  test('can create custom config', () => {
    const customConfig: RichMenuConfig = {
      name: 'custom-menu',
      chatBarText: '選單',
      selected: false,
      size: {
        width: 2500,
        height: 843,
      },
      areas: [
        {
          x: 0,
          y: 0,
          width: 2500,
          height: 843,
          action: {
            type: 'message',
            label: 'Full Button',
            text: '全螢幕按鈕',
          },
        },
      ],
    };

    expect(customConfig.name).toBe('custom-menu');
    expect(customConfig.areas.length).toBe(1);
    expect(customConfig.size.width).toBe(2500);
  });
});
