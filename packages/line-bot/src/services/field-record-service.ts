/**
 * Field Record Service
 *
 * Manages field records (planting, growth, harvest) for LINE bot users.
 * Provides database operations for the message handlers.
 */

import { eq, and, desc } from 'drizzle-orm';
import {
  getDatabase,
  plantingRecords,
  harvestRecords,
  growthRecords,
  users,
  fields,
  type Database,
} from '@minori/database';
import { findCropByName, predictHarvest } from '@minori/core';

/**
 * Field record service for managing user's field data.
 */
export class FieldRecordService {
  private db: Database;

  constructor(db?: Database) {
    this.db = db ?? getDatabase();
  }

  /**
   * Gets user by LINE user ID.
   */
  async getUserByLineId(lineUserId: string): Promise<{ id: string; cooperativeId: string } | null> {
    const [user] = await this.db
      .select({ id: users.id, cooperativeId: users.cooperativeId })
      .from(users)
      .where(eq(users.lineUserId, lineUserId))
      .limit(1);

    return user ?? null;
  }

  /**
   * Creates a planting record for a user.
   */
  async createPlantingRecord(params: {
    lineUserId: string;
    cropId: string;
    cropName: string;
    area: number;
    fieldId?: string;
    notes?: string;
  }): Promise<{
    id: string;
    expectedHarvestDate?: Date;
    expectedYield?: number;
    confidence?: number;
  }> {
    // Get user by LINE ID
    const user = await this.getUserByLineId(params.lineUserId);
    if (!user) {
      throw new Error('User not found. Please register first.');
    }

    // Get crop info for prediction
    const cropInfo = findCropByName(params.cropName);
    let expectedHarvestDate: Date | undefined;
    let expectedYield: number | undefined;
    let predictionConfidence: number | undefined;

    if (cropInfo) {
      const prediction = predictHarvest(cropInfo, new Date());
      expectedHarvestDate = prediction.predictions.likely;
      expectedYield = params.area * cropInfo.yield.perArea;
      predictionConfidence = prediction.confidence;
    }

    // Create planting record
    const insertedRecords = await this.db
      .insert(plantingRecords)
      .values({
        userId: user.id,
        fieldId: params.fieldId,
        cropId: params.cropId,
        cropName: params.cropName,
        areaSize: params.area,
        plantedAt: new Date(),
        expectedHarvestDate,
        expectedYield,
        predictionConfidence,
        status: 'active',
        notes: params.notes,
      })
      .returning({ id: plantingRecords.id });

    const record = insertedRecords[0];
    if (!record) {
      throw new Error('Failed to create planting record');
    }

    return {
      id: record.id,
      expectedHarvestDate,
      expectedYield,
      confidence: predictionConfidence,
    };
  }

  /**
   * Gets active planting records for a user.
   */
  async getActivePlantingRecords(lineUserId: string): Promise<
    Array<{
      id: string;
      cropId: string;
      cropName: string;
      area: number;
      plantedAt: Date;
      expectedHarvestDate?: Date;
      expectedYield?: number;
    }>
  > {
    const user = await this.getUserByLineId(lineUserId);
    if (!user) {
      return [];
    }

    const records = await this.db
      .select({
        id: plantingRecords.id,
        cropId: plantingRecords.cropId,
        cropName: plantingRecords.cropName,
        area: plantingRecords.areaSize,
        plantedAt: plantingRecords.plantedAt,
        expectedHarvestDate: plantingRecords.expectedHarvestDate,
        expectedYield: plantingRecords.expectedYield,
      })
      .from(plantingRecords)
      .where(and(eq(plantingRecords.userId, user.id), eq(plantingRecords.status, 'active')))
      .orderBy(desc(plantingRecords.plantedAt));

    return records.map((r) => ({
      id: r.id,
      cropId: r.cropId,
      cropName: r.cropName,
      area: r.area,
      plantedAt: r.plantedAt,
      expectedHarvestDate: r.expectedHarvestDate ?? undefined,
      expectedYield: r.expectedYield ?? undefined,
    }));
  }

  /**
   * Finds a planting record by crop name for a user.
   */
  async findPlantingRecordByCrop(
    lineUserId: string,
    cropName: string
  ): Promise<{
    id: string;
    cropId: string;
    cropName: string;
    userId: string;
  } | null> {
    const user = await this.getUserByLineId(lineUserId);
    if (!user) {
      return null;
    }

    // Find by crop name (case-insensitive search would be better)
    const cropInfo = findCropByName(cropName);
    if (!cropInfo) {
      return null;
    }

    const [record] = await this.db
      .select({
        id: plantingRecords.id,
        cropId: plantingRecords.cropId,
        cropName: plantingRecords.cropName,
        userId: plantingRecords.userId,
      })
      .from(plantingRecords)
      .where(
        and(
          eq(plantingRecords.userId, user.id),
          eq(plantingRecords.cropId, cropInfo.id),
          eq(plantingRecords.status, 'active')
        )
      )
      .orderBy(desc(plantingRecords.plantedAt))
      .limit(1);

    return record ?? null;
  }

  /**
   * Creates a harvest record for a user.
   */
  async createHarvestRecord(params: {
    lineUserId: string;
    cropName: string;
    quantity: number;
    qualityGrade?: 'A' | 'B' | 'C' | 'D';
    notes?: string;
  }): Promise<{ id: string; plantingRecordId?: string }> {
    const user = await this.getUserByLineId(params.lineUserId);
    if (!user) {
      throw new Error('User not found. Please register first.');
    }

    // Find the planting record for this crop
    const plantingRecord = await this.findPlantingRecordByCrop(params.lineUserId, params.cropName);

    // Get crop info
    const cropInfo = findCropByName(params.cropName);
    const cropId = cropInfo?.id ?? 'unknown';
    const cropName = cropInfo?.name ?? params.cropName;

    // Create harvest record
    const insertedRecords = await this.db
      .insert(harvestRecords)
      .values({
        plantingRecordId: plantingRecord?.id ?? '',
        userId: user.id,
        cropId,
        cropName,
        quantity: params.quantity,
        qualityGrade: params.qualityGrade,
        harvestedAt: new Date(),
        notes: params.notes,
      })
      .returning({ id: harvestRecords.id });

    const record = insertedRecords[0];
    if (!record) {
      throw new Error('Failed to create harvest record');
    }

    // If there's a matching planting record, mark it as harvested
    if (plantingRecord) {
      await this.db
        .update(plantingRecords)
        .set({ status: 'harvested' })
        .where(eq(plantingRecords.id, plantingRecord.id));
    }

    return {
      id: record.id,
      plantingRecordId: plantingRecord?.id,
    };
  }

  /**
   * Creates a growth record for a crop.
   */
  async createGrowthRecord(params: {
    lineUserId: string;
    cropName: string;
    condition: 'excellent' | 'good' | 'normal' | 'poor' | 'critical';
    notes?: string;
    images?: string[];
  }): Promise<{ id: string; plantingRecordId: string } | null> {
    // Find the planting record for this crop
    const plantingRecord = await this.findPlantingRecordByCrop(params.lineUserId, params.cropName);
    if (!plantingRecord) {
      return null;
    }

    // Create growth record
    const insertedRecords = await this.db
      .insert(growthRecords)
      .values({
        plantingRecordId: plantingRecord.id,
        condition: params.condition,
        notes: params.notes,
        images: params.images,
        recordedAt: new Date(),
      })
      .returning({ id: growthRecords.id });

    const record = insertedRecords[0];
    if (!record) {
      throw new Error('Failed to create growth record');
    }

    return {
      id: record.id,
      plantingRecordId: plantingRecord.id,
    };
  }

  /**
   * Gets user's fields.
   */
  async getUserFields(
    lineUserId: string
  ): Promise<Array<{ id: string; name: string; area?: number }>> {
    const user = await this.getUserByLineId(lineUserId);
    if (!user) {
      return [];
    }

    const results = await this.db
      .select({
        id: fields.id,
        name: fields.name,
        area: fields.areaSize,
      })
      .from(fields)
      .where(eq(fields.userId, user.id));

    return results.map((f) => ({
      id: f.id,
      name: f.name ?? 'Unnamed Field',
      area: f.area ?? undefined,
    }));
  }
}

/**
 * Singleton instance of the field record service.
 */
let fieldRecordServiceInstance: FieldRecordService | null = null;

/**
 * Gets the field record service instance.
 */
export function getFieldRecordService(): FieldRecordService {
  if (!fieldRecordServiceInstance) {
    fieldRecordServiceInstance = new FieldRecordService();
  }
  return fieldRecordServiceInstance;
}
