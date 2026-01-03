/**
 * Cooperative Service Module
 *
 * Provides aggregation and reporting services for agricultural cooperatives.
 * Enables cooperative administrators to query member data and generate reports.
 */

import type { CropSummary, SupplyItem, MemberCropReport, SupplyReport } from '@minori/shared';
import { getCropById } from '../crops/crop-database';
import { predictHarvest } from '../prediction/harvest-predictor';

/**
 * Mock farmer data for development.
 * TODO: Replace with actual database queries.
 */
interface MockFarmerRecord {
  farmerId: string;
  farmerName: string;
  cropId: string;
  area: number;
  plantingDate: Date;
}

/**
 * Generates mock farmer records for development.
 * In production, this would query the database.
 */
function getMockFarmerRecords(): MockFarmerRecord[] {
  const today = new Date();
  const daysAgo = (days: number) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

  return [
    {
      farmerId: 'f1',
      farmerName: '王大明',
      cropId: 'bok-choy',
      area: 2,
      plantingDate: daysAgo(25),
    },
    {
      farmerId: 'f2',
      farmerName: '李小華',
      cropId: 'bok-choy',
      area: 1.5,
      plantingDate: daysAgo(20),
    },
    {
      farmerId: 'f3',
      farmerName: '張阿土',
      cropId: 'bok-choy',
      area: 3,
      plantingDate: daysAgo(28),
    },
    {
      farmerId: 'f1',
      farmerName: '王大明',
      cropId: 'water-spinach',
      area: 1,
      plantingDate: daysAgo(22),
    },
    {
      farmerId: 'f4',
      farmerName: '陳美玉',
      cropId: 'water-spinach',
      area: 2,
      plantingDate: daysAgo(18),
    },
    {
      farmerId: 'f2',
      farmerName: '李小華',
      cropId: 'tomato',
      area: 0.5,
      plantingDate: daysAgo(45),
    },
    {
      farmerId: 'f3',
      farmerName: '張阿土',
      cropId: 'cucumber',
      area: 1,
      plantingDate: daysAgo(30),
    },
  ];
}

/**
 * Cooperative service for aggregating member data and generating reports.
 */
export class CooperativeService {
  private cooperativeId: string;

  constructor(cooperativeId: string = 'default') {
    this.cooperativeId = cooperativeId;
  }

  /**
   * Gets a summary of all crops being grown by cooperative members.
   *
   * @returns Member crop report with aggregated data
   */
  async getMemberCropReport(): Promise<MemberCropReport> {
    const records = getMockFarmerRecords();
    const farmerIds = new Set(records.map((r) => r.farmerId));

    // Group by crop
    const cropGroups = new Map<string, MockFarmerRecord[]>();
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

      const prediction = predictHarvest(cropInfo, avgPlantingDate);
      const estimatedYield = cropArea * cropInfo.yield.perArea;

      crops.push({
        cropId,
        cropName: cropInfo.name,
        totalArea: cropArea,
        farmerCount: new Set(groupRecords.map((r) => r.farmerId)).size,
        estimatedYield,
        estimatedHarvestDate: prediction.predictions.likely,
        confidence: prediction.confidence,
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
    const records = getMockFarmerRecords();

    // Group by crop
    const cropGroups = new Map<string, MockFarmerRecord[]>();
    for (const record of records) {
      const existing = cropGroups.get(record.cropId) || [];
      existing.push(record);
      cropGroups.set(record.cropId, existing);
    }

    const items: SupplyItem[] = [];

    for (const [cropId, groupRecords] of cropGroups) {
      const cropInfo = getCropById(cropId);
      if (!cropInfo) continue;

      // Check each farmer's harvest prediction
      const farmersInPeriod: SupplyItem['farmers'] = [];
      let earliestDate: Date | null = null;
      let latestDate: Date | null = null;

      for (const record of groupRecords) {
        const prediction = predictHarvest(cropInfo, record.plantingDate);
        const harvestDate = prediction.predictions.likely;

        // Check if harvest falls within the period
        if (harvestDate >= periodStart && harvestDate <= periodEnd) {
          const quantity = record.area * cropInfo.yield.perArea;
          farmersInPeriod.push({
            farmerId: record.farmerId,
            farmerName: record.farmerName,
            quantity,
            harvestDate,
          });

          if (!earliestDate || harvestDate < earliestDate) {
            earliestDate = harvestDate;
          }
          if (!latestDate || harvestDate > latestDate) {
            latestDate = harvestDate;
          }
        }
      }

      if (farmersInPeriod.length > 0) {
        items.push({
          cropId,
          cropName: cropInfo.name,
          estimatedQuantity: farmersInPeriod.reduce((sum, f) => sum + f.quantity, 0),
          farmerCount: farmersInPeriod.length,
          earliestDate: earliestDate!,
          latestDate: latestDate!,
          farmers: farmersInPeriod,
        });
      }
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
