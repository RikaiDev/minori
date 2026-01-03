/**
 * Unit tests for Export Service.
 */

import { describe, expect, test } from 'bun:test';
import { ExportService } from './export-service';
import type { MemberCropReport, SupplyReport } from '@minori/shared';

describe('ExportService', () => {
  const exportService = new ExportService();

  const mockMemberCropReport: MemberCropReport = {
    cooperativeId: 'test-coop',
    generatedAt: new Date('2025-01-03'),
    totalFarmers: 4,
    totalArea: 10.5,
    crops: [
      {
        cropId: 'bok-choy',
        cropName: '小白菜',
        totalArea: 6.5,
        farmerCount: 3,
        estimatedYield: 195,
        estimatedHarvestDate: new Date('2025-01-15'),
        confidence: 0.85,
      },
      {
        cropId: 'water-spinach',
        cropName: '空心菜',
        totalArea: 3,
        farmerCount: 2,
        estimatedYield: 90,
        estimatedHarvestDate: new Date('2025-01-20'),
        confidence: 0.8,
      },
    ],
  };

  const mockSupplyReport: SupplyReport = {
    cooperativeId: 'test-coop',
    periodStart: new Date('2025-01-06'),
    periodEnd: new Date('2025-01-12'),
    generatedAt: new Date('2025-01-03'),
    items: [
      {
        cropId: 'bok-choy',
        cropName: '小白菜',
        estimatedQuantity: 120,
        farmerCount: 2,
        earliestDate: new Date('2025-01-08'),
        latestDate: new Date('2025-01-10'),
        farmers: [
          {
            farmerId: 'f1',
            farmerName: '王大明',
            quantity: 60,
            harvestDate: new Date('2025-01-08'),
          },
          {
            farmerId: 'f2',
            farmerName: '李小華',
            quantity: 60,
            harvestDate: new Date('2025-01-10'),
          },
        ],
      },
    ],
  };

  describe('exportMemberCropReport', () => {
    test('exports to CSV format by default', async () => {
      const result = await exportService.exportMemberCropReport(mockMemberCropReport);

      expect(result.filename).toContain('會員作物報表');
      expect(result.filename).toEndWith('.csv');
      expect(result.mimeType).toBe('text/csv; charset=utf-8');
      expect(typeof result.data).toBe('string');
    });

    test('CSV contains headers', async () => {
      const result = await exportService.exportMemberCropReport(mockMemberCropReport, 'csv');
      const data = result.data as string;

      expect(data).toContain('作物名稱');
      expect(data).toContain('總面積');
      expect(data).toContain('農友數');
      expect(data).toContain('預估產量');
    });

    test('CSV contains crop data', async () => {
      const result = await exportService.exportMemberCropReport(mockMemberCropReport, 'csv');
      const data = result.data as string;

      expect(data).toContain('小白菜');
      expect(data).toContain('空心菜');
      expect(data).toContain('6.5');
      expect(data).toContain('195');
    });

    test('exports to JSON format', async () => {
      const result = await exportService.exportMemberCropReport(mockMemberCropReport, 'json');

      expect(result.filename).toContain('會員作物報表');
      expect(result.filename).toEndWith('.json');
      expect(result.mimeType).toBe('application/json');

      const data = JSON.parse(result.data as string);
      expect(data.cooperativeId).toBe('test-coop');
      expect(data.crops.length).toBe(2);
    });

    test('CSV has BOM for Excel compatibility', async () => {
      const result = await exportService.exportMemberCropReport(mockMemberCropReport, 'csv');
      const data = result.data as string;

      // BOM is \uFEFF
      expect(data.charCodeAt(0)).toBe(0xfeff);
    });
  });

  describe('exportSupplyReport', () => {
    test('exports to CSV format by default', async () => {
      const result = await exportService.exportSupplyReport(mockSupplyReport);

      expect(result.filename).toContain('出貨報表');
      expect(result.filename).toEndWith('.csv');
      expect(result.mimeType).toBe('text/csv; charset=utf-8');
    });

    test('CSV contains supply data', async () => {
      const result = await exportService.exportSupplyReport(mockSupplyReport, 'csv');
      const data = result.data as string;

      expect(data).toContain('小白菜');
      expect(data).toContain('120');
      expect(data).toContain('王大明');
      expect(data).toContain('李小華');
    });

    test('exports to JSON format', async () => {
      const result = await exportService.exportSupplyReport(mockSupplyReport, 'json');

      expect(result.filename).toEndWith('.json');
      expect(result.mimeType).toBe('application/json');

      const data = JSON.parse(result.data as string);
      expect(data.items.length).toBe(1);
      expect(data.items[0].cropName).toBe('小白菜');
    });

    test('filename includes period range', async () => {
      const result = await exportService.exportSupplyReport(mockSupplyReport);

      expect(result.filename).toContain('1/6');
      expect(result.filename).toContain('1/12');
    });
  });
});
