/**
 * Unit tests for Cooperative Handler.
 */

import { describe, expect, test, mock, beforeEach } from 'bun:test';

// Define mock function types - use 'any' for args to allow proper function signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn<T extends (...args: any[]) => any> = ReturnType<typeof mock<T>> & {
  mockResolvedValueOnce: (value: Awaited<ReturnType<T>>) => void;
  mockRejectedValueOnce: (error: Error) => void;
};

// Report types
interface MemberCropReport {
  cooperativeId: string;
  generatedAt: Date;
  totalFarmers: number;
  totalArea: number;
  crops: Array<{
    cropId: string;
    cropName: string;
    totalArea: number;
    farmerCount: number;
    estimatedYield: number;
    estimatedHarvestDate: Date;
    confidence: number;
  }>;
}

interface SupplyReport {
  cooperativeId: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  items: Array<{
    cropId: string;
    cropName: string;
    estimatedQuantity: number;
    farmerCount: number;
    earliestDate: Date;
    latestDate: Date;
    farmers: Array<{
      farmerId: string;
      farmerName: string;
      quantity: number;
      harvestDate: Date;
    }>;
  }>;
}

// Mock dependencies
const mockGetMemberCropReport = mock(() =>
  Promise.resolve({
    cooperativeId: 'coop-1',
    generatedAt: new Date('2025-01-03'),
    totalFarmers: 3,
    totalArea: 8.5,
    crops: [
      {
        cropId: 'bok-choy',
        cropName: '小白菜',
        totalArea: 5,
        farmerCount: 2,
        estimatedYield: 150,
        estimatedHarvestDate: new Date('2025-01-15'),
        confidence: 0.85,
      },
    ],
  } as MemberCropReport)
) as MockFn<() => Promise<MemberCropReport>>;

const mockGetThisWeekSupply = mock(() =>
  Promise.resolve({
    cooperativeId: 'coop-1',
    periodStart: new Date('2025-01-06'),
    periodEnd: new Date('2025-01-12'),
    generatedAt: new Date('2025-01-03'),
    items: [
      {
        cropId: 'bok-choy',
        cropName: '小白菜',
        estimatedQuantity: 100,
        farmerCount: 2,
        earliestDate: new Date('2025-01-08'),
        latestDate: new Date('2025-01-10'),
        farmers: [
          {
            farmerId: 'f1',
            farmerName: '王大明',
            quantity: 50,
            harvestDate: new Date('2025-01-08'),
          },
          {
            farmerId: 'f2',
            farmerName: '李小華',
            quantity: 50,
            harvestDate: new Date('2025-01-10'),
          },
        ],
      },
    ],
  } as SupplyReport)
) as MockFn<() => Promise<SupplyReport>>;

const mockGetNextWeekSupply = mock(() =>
  Promise.resolve({
    cooperativeId: 'coop-1',
    periodStart: new Date('2025-01-13'),
    periodEnd: new Date('2025-01-19'),
    generatedAt: new Date('2025-01-03'),
    items: [
      {
        cropId: 'water-spinach',
        cropName: '空心菜',
        estimatedQuantity: 80,
        farmerCount: 1,
        earliestDate: new Date('2025-01-15'),
        latestDate: new Date('2025-01-17'),
        farmers: [
          {
            farmerId: 'f3',
            farmerName: '陳美玲',
            quantity: 80,
            harvestDate: new Date('2025-01-15'),
          },
        ],
      },
    ],
  } as SupplyReport)
) as MockFn<() => Promise<SupplyReport>>;

interface ExportResult {
  filename: string;
  mimeType: string;
  data: string;
}

const mockExportMemberCropReport = mock(() =>
  Promise.resolve({
    filename: '會員作物報表_2025-01-03.csv',
    mimeType: 'text/csv',
    data: 'csv data',
  } as ExportResult)
) as MockFn<(report: MemberCropReport, format: string) => Promise<ExportResult>>;

const mockExportSupplyReport = mock(() =>
  Promise.resolve({
    filename: '出貨報表_2025-01-03.csv',
    mimeType: 'text/csv',
    data: 'csv data',
  } as ExportResult)
) as MockFn<(report: SupplyReport, format: string) => Promise<ExportResult>>;

mock.module('@minori/core', () => ({
  CooperativeService: class {
    cooperativeId: string;
    constructor(cooperativeId: string) {
      this.cooperativeId = cooperativeId;
    }
    getMemberCropReport = mockGetMemberCropReport;
    getThisWeekSupply = mockGetThisWeekSupply;
    getNextWeekSupply = mockGetNextWeekSupply;
  },
  ExportService: class {
    exportMemberCropReport = mockExportMemberCropReport;
    exportSupplyReport = mockExportSupplyReport;
  },
}));

mock.module('@minori/shared', () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
  formatDate: (date: Date) => date.toISOString().split('T')[0],
}));

mock.module('../client', () => ({
  QuickReplyPresets: {
    helpCancel: () => [
      { label: '說明', text: '說明' },
      { label: '取消', text: '取消' },
    ],
  },
}));

import {
  handleMemberCropsQuery,
  handleSupplyQuery,
  handleExportReport,
  handleCooperativeAction,
  CooperativeQuickReplyPresets,
} from './cooperative-handler';

describe('CooperativeQuickReplyPresets', () => {
  test('mainMenu returns cooperative menu options', () => {
    const buttons = CooperativeQuickReplyPresets.mainMenu();
    expect(buttons.length).toBe(4);
    expect(buttons.map((b) => b.label)).toContain('會員作物');
    expect(buttons.map((b) => b.label)).toContain('本週出貨');
    expect(buttons.map((b) => b.label)).toContain('下週出貨');
    expect(buttons.map((b) => b.label)).toContain('匯出報表');
  });

  test('reportTypes returns report selection options', () => {
    const buttons = CooperativeQuickReplyPresets.reportTypes();
    expect(buttons.length).toBe(3);
    expect(buttons.map((b) => b.label)).toContain('會員作物報表');
    expect(buttons.map((b) => b.label)).toContain('出貨報表');
    expect(buttons.map((b) => b.label)).toContain('取消');
  });

  test('exportFormats returns format selection options', () => {
    const buttons = CooperativeQuickReplyPresets.exportFormats();
    expect(buttons.length).toBe(3);
    expect(buttons.map((b) => b.label)).toContain('Excel (CSV)');
    expect(buttons.map((b) => b.label)).toContain('JSON');
    expect(buttons.map((b) => b.label)).toContain('取消');
  });

  test('afterQuery returns follow-up options', () => {
    const buttons = CooperativeQuickReplyPresets.afterQuery();
    expect(buttons.length).toBe(2);
    expect(buttons.map((b) => b.label)).toContain('匯出報表');
    expect(buttons.map((b) => b.label)).toContain('其他查詢');
  });
});

describe('handleMemberCropsQuery', () => {
  beforeEach(() => {
    mockGetMemberCropReport.mockClear();
  });

  test('returns crop summary from cooperative service', async () => {
    const response = await handleMemberCropsQuery('coop-1');

    expect(mockGetMemberCropReport).toHaveBeenCalled();
    expect(response.text).toContain('cooperative.memberCrops.title');
    expect(response.text).toContain('cooperative.memberCrops.summary');
  });

  test('includes total farmers and area in summary', async () => {
    const response = await handleMemberCropsQuery('coop-1');

    expect(response.text).toContain('"farmers":3');
    expect(response.text).toContain('"area":"8.5"');
  });

  test('includes crop details', async () => {
    const response = await handleMemberCropsQuery('coop-1');

    expect(response.text).toContain('cooperative.memberCrops.item');
    expect(response.text).toContain('"crop":"小白菜"');
  });

  test('returns empty message when no crops', async () => {
    mockGetMemberCropReport.mockResolvedValueOnce({
      cooperativeId: 'coop-1',
      generatedAt: new Date(),
      totalFarmers: 0,
      totalArea: 0,
      crops: [],
    });

    const response = await handleMemberCropsQuery('coop-1');

    expect(response.text).toBe('cooperative.memberCrops.empty');
  });

  test('returns afterQuery quick replies', async () => {
    const response = await handleMemberCropsQuery('coop-1');

    expect(response.quickReply).toBeDefined();
    expect(response.quickReply?.map((b) => b.label)).toContain('匯出報表');
  });

  test('handles errors gracefully', async () => {
    mockGetMemberCropReport.mockRejectedValueOnce(new Error('Database error'));

    const response = await handleMemberCropsQuery('coop-1');

    expect(response.text).toBe('cooperative.error');
    expect(response.quickReply?.map((b) => b.label)).toContain('會員作物');
  });
});

describe('handleSupplyQuery', () => {
  beforeEach(() => {
    mockGetThisWeekSupply.mockClear();
    mockGetNextWeekSupply.mockClear();
  });

  test('queries this week supply when period is thisWeek', async () => {
    const response = await handleSupplyQuery('coop-1', 'thisWeek');

    expect(mockGetThisWeekSupply).toHaveBeenCalled();
    expect(mockGetNextWeekSupply).not.toHaveBeenCalled();
    expect(response.text).toContain('"period":"本週"');
  });

  test('queries next week supply by default', async () => {
    const response = await handleSupplyQuery('coop-1');

    expect(mockGetNextWeekSupply).toHaveBeenCalled();
    expect(mockGetThisWeekSupply).not.toHaveBeenCalled();
    expect(response.text).toContain('"period":"下週"');
  });

  test('includes supply item details', async () => {
    const response = await handleSupplyQuery('coop-1', 'thisWeek');

    expect(response.text).toContain('cooperative.supply.item');
    expect(response.text).toContain('"crop":"小白菜"');
    expect(response.text).toContain('"quantity":"100"');
  });

  test('includes farmer names in supply items', async () => {
    const response = await handleSupplyQuery('coop-1', 'thisWeek');

    expect(response.text).toContain('王大明');
    expect(response.text).toContain('李小華');
  });

  test('returns empty message when no supply', async () => {
    mockGetNextWeekSupply.mockResolvedValueOnce({
      cooperativeId: 'coop-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      generatedAt: new Date(),
      items: [],
    });

    const response = await handleSupplyQuery('coop-1', 'nextWeek');

    expect(response.text).toContain('cooperative.supply.empty');
    expect(response.text).toContain('"period":"下週"');
  });

  test('handles errors gracefully', async () => {
    mockGetNextWeekSupply.mockRejectedValueOnce(new Error('Database error'));

    const response = await handleSupplyQuery('coop-1', 'nextWeek');

    expect(response.text).toBe('cooperative.error');
  });
});

describe('handleExportReport', () => {
  beforeEach(() => {
    mockExportMemberCropReport.mockClear();
    mockExportSupplyReport.mockClear();
    mockGetMemberCropReport.mockClear();
    mockGetNextWeekSupply.mockClear();
  });

  test('exports member crops report by default', async () => {
    const response = await handleExportReport('coop-1');

    expect(mockGetMemberCropReport).toHaveBeenCalled();
    expect(mockExportMemberCropReport).toHaveBeenCalled();
    expect(response.text).toContain('cooperative.export.success');
  });

  test('exports supply report when type is supply', async () => {
    const response = await handleExportReport('coop-1', 'supply');

    expect(mockGetNextWeekSupply).toHaveBeenCalled();
    expect(mockExportSupplyReport).toHaveBeenCalled();
    expect(response.text).toContain('cooperative.export.success');
  });

  test('includes filename in success message', async () => {
    const response = await handleExportReport('coop-1', 'member_crops', 'csv');

    expect(response.text).toContain('"filename":"會員作物報表_2025-01-03.csv"');
  });

  test('returns error for unknown report type', async () => {
    const response = await handleExportReport('coop-1', 'unknown' as 'member_crops');

    expect(response.text).toBe('cooperative.export.unknownType');
    expect(response.quickReply?.map((b) => b.label)).toContain('會員作物報表');
  });

  test('handles export errors gracefully', async () => {
    mockExportMemberCropReport.mockRejectedValueOnce(new Error('Export failed'));

    const response = await handleExportReport('coop-1');

    expect(response.text).toBe('cooperative.export.error');
  });
});

describe('handleCooperativeAction', () => {
  beforeEach(() => {
    mockGetMemberCropReport.mockClear();
    mockGetThisWeekSupply.mockClear();
    mockGetNextWeekSupply.mockClear();
  });

  test('routes query_member_crops to member crops handler', async () => {
    const response = await handleCooperativeAction('query_member_crops', {}, 'coop-1');

    expect(mockGetMemberCropReport).toHaveBeenCalled();
    expect(response.text).toContain('cooperative.memberCrops');
  });

  test('routes query_supply to supply handler with nextWeek by default', async () => {
    const response = await handleCooperativeAction('query_supply', {}, 'coop-1');

    expect(mockGetNextWeekSupply).toHaveBeenCalled();
    expect(response.text).toContain('cooperative.supply');
  });

  test('routes query_supply to this week when dateExpression contains 本週', async () => {
    await handleCooperativeAction('query_supply', { dateExpression: '本週' }, 'coop-1');

    expect(mockGetThisWeekSupply).toHaveBeenCalled();
  });

  test('routes export_report to show report type selection', async () => {
    const response = await handleCooperativeAction('export_report', {}, 'coop-1');

    expect(response.text).toBe('cooperative.export.askType');
    expect(response.quickReply?.map((b) => b.label)).toContain('會員作物報表');
    expect(response.quickReply?.map((b) => b.label)).toContain('出貨報表');
  });

  test('returns unknown intent for unrecognized actions', async () => {
    const response = await handleCooperativeAction('unknown_action', {}, 'coop-1');

    // Unknown actions should still return a valid response
    expect(response.text).toBeDefined();
    expect(response.quickReply).toBeDefined();
  });
});
