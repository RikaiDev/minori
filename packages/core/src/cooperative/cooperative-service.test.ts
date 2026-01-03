/**
 * Unit tests for Cooperative Service.
 */

import { describe, expect, test } from 'bun:test';
import { CooperativeService } from './cooperative-service';

describe('CooperativeService', () => {
  const service = new CooperativeService('test-coop');

  describe('getMemberCropReport', () => {
    test('returns report with crops and farmers', async () => {
      const report = await service.getMemberCropReport();

      expect(report.cooperativeId).toBe('test-coop');
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.totalFarmers).toBeGreaterThan(0);
      expect(report.totalArea).toBeGreaterThan(0);
      expect(report.crops.length).toBeGreaterThan(0);
    });

    test('each crop has required fields', async () => {
      const report = await service.getMemberCropReport();

      for (const crop of report.crops) {
        expect(crop.cropId).toBeDefined();
        expect(crop.cropName).toBeDefined();
        expect(crop.totalArea).toBeGreaterThan(0);
        expect(crop.farmerCount).toBeGreaterThan(0);
        expect(crop.estimatedYield).toBeGreaterThan(0);
        expect(crop.estimatedHarvestDate).toBeInstanceOf(Date);
        expect(crop.confidence).toBeGreaterThanOrEqual(0);
        expect(crop.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('crops are sorted by estimated harvest date', async () => {
      const report = await service.getMemberCropReport();

      for (let i = 1; i < report.crops.length; i++) {
        const prevDate = report.crops[i - 1]!.estimatedHarvestDate.getTime();
        const currDate = report.crops[i]!.estimatedHarvestDate.getTime();
        expect(currDate).toBeGreaterThanOrEqual(prevDate);
      }
    });
  });

  describe('getSupplyReport', () => {
    test('returns report for date range', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const report = await service.getSupplyReport(startDate, endDate);

      expect(report.cooperativeId).toBe('test-coop');
      expect(report.periodStart).toEqual(startDate);
      expect(report.periodEnd).toEqual(endDate);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(Array.isArray(report.items)).toBe(true);
    });

    test('supply items have required fields', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const report = await service.getSupplyReport(startDate, endDate);

      for (const item of report.items) {
        expect(item.cropId).toBeDefined();
        expect(item.cropName).toBeDefined();
        expect(item.estimatedQuantity).toBeGreaterThan(0);
        expect(item.farmerCount).toBeGreaterThan(0);
        expect(item.earliestDate).toBeInstanceOf(Date);
        expect(item.latestDate).toBeInstanceOf(Date);
        expect(Array.isArray(item.farmers)).toBe(true);
        expect(item.farmers.length).toBeGreaterThan(0);
      }
    });

    test('supply items are sorted by quantity descending', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const report = await service.getSupplyReport(startDate, endDate);

      for (let i = 1; i < report.items.length; i++) {
        const prevQty = report.items[i - 1]!.estimatedQuantity;
        const currQty = report.items[i]!.estimatedQuantity;
        expect(prevQty).toBeGreaterThanOrEqual(currQty);
      }
    });

    test('farmer details include name and quantity', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const report = await service.getSupplyReport(startDate, endDate);

      for (const item of report.items) {
        for (const farmer of item.farmers) {
          expect(farmer.farmerId).toBeDefined();
          expect(farmer.farmerName).toBeDefined();
          expect(farmer.quantity).toBeGreaterThan(0);
          expect(farmer.harvestDate).toBeInstanceOf(Date);
        }
      }
    });
  });

  describe('getNextWeekSupply', () => {
    test('returns supply for next 7 days', async () => {
      const report = await service.getNextWeekSupply();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      expect(report.periodStart.getTime()).toBeCloseTo(today.getTime(), -3);
      expect(report.periodEnd.getTime()).toBeCloseTo(nextWeek.getTime(), -3);
    });
  });

  describe('getThisWeekSupply', () => {
    test('returns supply for current week', async () => {
      const report = await service.getThisWeekSupply();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Start of week is Sunday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      expect(report.periodStart.getTime()).toBe(startOfWeek.getTime());
    });
  });
});
