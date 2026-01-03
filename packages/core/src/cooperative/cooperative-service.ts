/**
 * Cooperative Service Module
 *
 * Provides aggregation and reporting services for agricultural cooperatives.
 * Enables cooperative administrators to query member data and generate reports.
 */

import { eq, and, gte, lte } from 'drizzle-orm';
import { getDatabase, plantingRecords, users, type Database } from '@minori/database';
import type { CropSummary, SupplyItem, MemberCropReport, SupplyReport } from '@minori/shared';
import { getCropById } from '../crops/crop-database';
import { predictHarvest } from '../prediction/harvest-predictor';

/**
 * Internal farmer record type from database query.
 */
interface FarmerRecord {
  farmerId: string;
  farmerName: string | null;
  cropId: string;
  cropName: string;
  area: number;
  plantingDate: Date;
  expectedHarvestDate: Date | null;
  expectedYield: number | null;
  predictionConfidence: number | null;
}

/**
 * Cooperative service for aggregating member data and generating reports.
 */
export class CooperativeService {
  private cooperativeId: string;
  private db: Database;

  constructor(cooperativeId: string = 'default', db?: Database) {
    this.cooperativeId = cooperativeId;
    this.db = db ?? getDatabase();
  }

  /**
   * Gets active planting records for all cooperative members.
   */
  private async getFarmerRecords(): Promise<FarmerRecord[]> {
    const results = await this.db
      .select({
        farmerId: plantingRecords.userId,
        farmerName: users.name,
        cropId: plantingRecords.cropId,
        cropName: plantingRecords.cropName,
        area: plantingRecords.areaSize,
        plantingDate: plantingRecords.plantedAt,
        expectedHarvestDate: plantingRecords.expectedHarvestDate,
        expectedYield: plantingRecords.expectedYield,
        predictionConfidence: plantingRecords.predictionConfidence,
      })
      .from(plantingRecords)
      .innerJoin(users, eq(plantingRecords.userId, users.id))
      .where(
        and(eq(users.cooperativeId, this.cooperativeId), eq(plantingRecords.status, 'active'))
      );

    return results.map((r) => ({
      farmerId: r.farmerId,
      farmerName: r.farmerName,
      cropId: r.cropId,
      cropName: r.cropName,
      area: r.area,
      plantingDate: r.plantingDate,
      expectedHarvestDate: r.expectedHarvestDate,
      expectedYield: r.expectedYield,
      predictionConfidence: r.predictionConfidence,
    }));
  }

  /**
   * Gets a summary of all crops being grown by cooperative members.
   *
   * @returns Member crop report with aggregated data
   */
  async getMemberCropReport(): Promise<MemberCropReport> {
    const records = await this.getFarmerRecords();
    const farmerIds = new Set(records.map((r) => r.farmerId));

    // Group by crop
    const cropGroups = new Map<string, FarmerRecord[]>();
    for (const record of records) {
      const existing = cropGroups.get(record.cropId) || [];
      existing.push(record);
      cropGroups.set(record.cropId, existing);
    }

    // Build crop summaries
    const crops: CropSummary[] = [];
    let totalArea = 0;

    for (const [cropId, groupRecords] of cropGroups) {
      const cropInfo = getCropById(cropId);
      if (!cropInfo) continue;

      const cropArea = groupRecords.reduce((sum, r) => sum + r.area, 0);
      totalArea += cropArea;

      // Calculate average planting date for prediction
      const avgPlantingTime =
        groupRecords.reduce((sum, r) => sum + r.plantingDate.getTime(), 0) / groupRecords.length;
      const avgPlantingDate = new Date(avgPlantingTime);

      // Use stored predictions if available, otherwise calculate
      const recordsWithPrediction = groupRecords.filter((r) => r.expectedHarvestDate);
      let estimatedHarvestDate: Date;
      let confidence: number;
      let estimatedYield: number;

      if (recordsWithPrediction.length > 0) {
        // Use average of stored predictions
        const avgHarvestTime =
          recordsWithPrediction.reduce((sum, r) => sum + r.expectedHarvestDate!.getTime(), 0) /
          recordsWithPrediction.length;
        estimatedHarvestDate = new Date(avgHarvestTime);

        confidence =
          recordsWithPrediction.reduce((sum, r) => sum + (r.predictionConfidence ?? 0.7), 0) /
          recordsWithPrediction.length;

        estimatedYield = groupRecords.reduce(
          (sum, r) => sum + (r.expectedYield ?? r.area * cropInfo.yield.perArea),
          0
        );
      } else {
        // Fall back to calculating prediction
        const prediction = predictHarvest(cropInfo, avgPlantingDate);
        estimatedHarvestDate = prediction.predictions.likely;
        confidence = prediction.confidence;
        estimatedYield = cropArea * cropInfo.yield.perArea;
      }

      crops.push({
        cropId,
        cropName: cropInfo.name,
        totalArea: cropArea,
        farmerCount: new Set(groupRecords.map((r) => r.farmerId)).size,
        estimatedYield,
        estimatedHarvestDate,
        confidence,
      });
    }

    // Sort by estimated harvest date
    crops.sort((a, b) => a.estimatedHarvestDate.getTime() - b.estimatedHarvestDate.getTime());

    return {
      cooperativeId: this.cooperativeId,
      generatedAt: new Date(),
      totalFarmers: farmerIds.size,
      totalArea,
      crops,
    };
  }

  /**
   * Gets supply availability for a given time period.
   *
   * @param periodStart - Start of the period to check
   * @param periodEnd - End of the period to check
   * @returns Supply report with available items
   */
  async getSupplyReport(periodStart: Date, periodEnd: Date): Promise<SupplyReport> {
    // Query records that have expected harvest dates in the period
    const results = await this.db
      .select({
        farmerId: plantingRecords.userId,
        farmerName: users.name,
        cropId: plantingRecords.cropId,
        cropName: plantingRecords.cropName,
        area: plantingRecords.areaSize,
        plantingDate: plantingRecords.plantedAt,
        expectedHarvestDate: plantingRecords.expectedHarvestDate,
        expectedYield: plantingRecords.expectedYield,
      })
      .from(plantingRecords)
      .innerJoin(users, eq(plantingRecords.userId, users.id))
      .where(
        and(
          eq(users.cooperativeId, this.cooperativeId),
          eq(plantingRecords.status, 'active'),
          gte(plantingRecords.expectedHarvestDate, periodStart),
          lte(plantingRecords.expectedHarvestDate, periodEnd)
        )
      );

    // Group by crop
    const cropGroups = new Map<
      string,
      {
        cropId: string;
        cropName: string;
        farmers: Array<{
          farmerId: string;
          farmerName: string;
          quantity: number;
          harvestDate: Date;
        }>;
      }
    >();

    for (const record of results) {
      if (!record.expectedHarvestDate) continue;

      const cropInfo = getCropById(record.cropId);
      const quantity =
        record.expectedYield ??
        (cropInfo ? record.area * cropInfo.yield.perArea : record.area * 100);

      let group = cropGroups.get(record.cropId);
      if (!group) {
        group = {
          cropId: record.cropId,
          cropName: record.cropName,
          farmers: [],
        };
        cropGroups.set(record.cropId, group);
      }

      group.farmers.push({
        farmerId: record.farmerId,
        farmerName: record.farmerName ?? 'Unknown',
        quantity,
        harvestDate: record.expectedHarvestDate,
      });
    }

    // Build supply items
    const items: SupplyItem[] = [];

    for (const group of cropGroups.values()) {
      if (group.farmers.length === 0) continue;

      const sortedByDate = [...group.farmers].sort(
        (a, b) => a.harvestDate.getTime() - b.harvestDate.getTime()
      );

      const earliest = sortedByDate[0];
      const latest = sortedByDate[sortedByDate.length - 1];

      if (!earliest || !latest) continue;

      items.push({
        cropId: group.cropId,
        cropName: group.cropName,
        estimatedQuantity: group.farmers.reduce((sum, f) => sum + f.quantity, 0),
        farmerCount: group.farmers.length,
        earliestDate: earliest.harvestDate,
        latestDate: latest.harvestDate,
        farmers: group.farmers,
      });
    }

    // Sort by total quantity (descending)
    items.sort((a, b) => b.estimatedQuantity - a.estimatedQuantity);

    return {
      cooperativeId: this.cooperativeId,
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      items,
    };
  }

  /**
   * Gets supply availability for the next week.
   *
   * @returns Supply report for the coming week
   */
  async getNextWeekSupply(): Promise<SupplyReport> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this.getSupplyReport(today, nextWeek);
  }

  /**
   * Gets supply availability for the current week.
   *
   * @returns Supply report for the current week
   */
  async getThisWeekSupply(): Promise<SupplyReport> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Get end of week (Saturday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return this.getSupplyReport(startOfWeek, endOfWeek);
  }
}

/**
 * Factory function to create a cooperative service.
 */
export function createCooperativeService(cooperativeId: string, db?: Database): CooperativeService {
  return new CooperativeService(cooperativeId, db);
}
