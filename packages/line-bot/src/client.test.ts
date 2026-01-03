/**
 * Unit tests for LINE Bot client functions.
 */

import { describe, expect, test } from 'bun:test';
import { createQuickReply, QuickReplyPresets, type QuickReplyButton } from './client';

describe('createQuickReply', () => {
  test('creates quick reply from buttons', () => {
    const buttons: QuickReplyButton[] = [
      { label: '確認', text: '確認' },
      { label: '取消', text: '取消' },
    ];

    const quickReply = createQuickReply(buttons);

    expect(quickReply.items).toBeDefined();
    expect(quickReply.items.length).toBe(2);
    expect(quickReply.items[0]!.type).toBe('action');
  });

  test('uses label as text if text not provided', () => {
    const buttons: QuickReplyButton[] = [{ label: '說明' }];

    const quickReply = createQuickReply(buttons);

    expect(quickReply.items[0]!.action).toBeDefined();
    const action = quickReply.items[0]!.action as { text: string };
    expect(action.text).toBe('說明');
  });

  test('truncates long labels to 20 characters', () => {
    const buttons: QuickReplyButton[] = [{ label: '這是一個非常長的標籤文字超過二十個字元' }];

    const quickReply = createQuickReply(buttons);

    const action = quickReply.items[0]!.action as { label: string };
    expect(action.label.length).toBeLessThanOrEqual(20);
  });

  test('includes imageUrl when provided', () => {
    const buttons: QuickReplyButton[] = [
      { label: '說明', imageUrl: 'https://example.com/icon.png' },
    ];

    const quickReply = createQuickReply(buttons);

    expect(quickReply.items[0]!.imageUrl).toBe('https://example.com/icon.png');
  });
});

describe('QuickReplyPresets', () => {
  test('confirm preset has confirm and cancel buttons', () => {
    const buttons = QuickReplyPresets.confirm();

    expect(buttons.length).toBe(2);
    expect(buttons[0]!.label).toBe('確認');
    expect(buttons[1]!.label).toBe('取消');
  });

  test('mainMenu preset has 4 options', () => {
    const buttons = QuickReplyPresets.mainMenu();

    expect(buttons.length).toBe(4);
    expect(buttons.map((b) => b.label)).toContain('記錄播種');
    expect(buttons.map((b) => b.label)).toContain('記錄採收');
    expect(buttons.map((b) => b.label)).toContain('查詢價格');
    expect(buttons.map((b) => b.label)).toContain('天氣預報');
  });

  test('afterPlanting preset has follow-up actions', () => {
    const buttons = QuickReplyPresets.afterPlanting();

    expect(buttons.length).toBe(3);
    expect(buttons.map((b) => b.label)).toContain('查看預測');
    expect(buttons.map((b) => b.label)).toContain('記錄更多');
    expect(buttons.map((b) => b.label)).toContain('回主選單');
  });

  test('afterHarvest preset has harvest follow-up actions', () => {
    const buttons = QuickReplyPresets.afterHarvest();

    expect(buttons.length).toBe(3);
    expect(buttons.map((b) => b.label)).toContain('查詢價格');
    expect(buttons.map((b) => b.label)).toContain('通知合作社');
    expect(buttons.map((b) => b.label)).toContain('回主選單');
  });

  test('commonCrops preset has common crop options', () => {
    const buttons = QuickReplyPresets.commonCrops();

    expect(buttons.length).toBe(4);
    expect(buttons.map((b) => b.label)).toContain('小白菜');
    expect(buttons.map((b) => b.label)).toContain('青江菜');
    expect(buttons.map((b) => b.label)).toContain('空心菜');
    expect(buttons.map((b) => b.label)).toContain('番茄');
  });

  test('areaUnits preset has area options', () => {
    const buttons = QuickReplyPresets.areaUnits();

    expect(buttons.length).toBe(4);
    expect(buttons.map((b) => b.label)).toContain('1分地');
    expect(buttons.map((b) => b.label)).toContain('2分地');
    expect(buttons.map((b) => b.label)).toContain('3分地');
    expect(buttons.map((b) => b.label)).toContain('半甲地');
  });

  test('helpCancel preset has help and cancel', () => {
    const buttons = QuickReplyPresets.helpCancel();

    expect(buttons.length).toBe(2);
    expect(buttons[0]!.label).toBe('說明');
    expect(buttons[1]!.label).toBe('取消');
  });
});
