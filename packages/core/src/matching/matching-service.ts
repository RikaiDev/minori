/**
 * Matching Service
 *
 * Service for managing supply-demand matching operations.
 * Coordinates between demands, supply, and match creation.
 */

import { eq, and, gt, or, gte, lte, desc } from 'drizzle-orm';
import {
  getDatabase,
  demands,
  matches,
  plantingRecords,
  users,
  cooperatives,
  type Database,
} from '@minori/database';
import type {
  DemandRequest,
  SupplyDemandMatch,
  MatchSuggestion,
  MatchingSummary,
  MatchScore,
} from '@minori/shared';

import {
  rankSupplyCandidates,
  canFullyMatch,
  selectOptimalSupply,
  type SupplyCandidate,
  type MatchingWeights,
} from './matching-algorithm';

/**
 * Configuration for the matching service.
 */
export interface MatchingServiceConfig {
  /** Minimum match score threshold (0-100) */
  minMatchScore?: number;
  /** Maximum suggestions per demand */
  maxSuggestionsPerDemand?: number;
  /** Custom matching weights */
  weights?: MatchingWeights;
}

const DEFAULT_CONFIG: Required<MatchingServiceConfig> = {
  minMatchScore: 40,
  maxSuggestionsPerDemand: 10,
  weights: {
    crop: 1.0,
    quantity: 0.25,
    date: 0.3,
    price: 0.15,
    quality: 0.15,
    region: 0.15,
  },
};

/**
 * Service for managing supply-demand matching.
 */
export class MatchingService {
  private cooperativeId: string;
  private config: Required<MatchingServiceConfig>;
  private db: Database;

  constructor(cooperativeId: string, config?: MatchingServiceConfig, db?: Database) {
    this.cooperativeId = cooperativeId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = db ?? getDatabase();
  }

  // ============================================
  // Demand Management
  // ============================================

  /**
   * Creates a new demand request.
   */
  async createDemand(
    demand: Omit<DemandRequest, 'id' | 'matchedQuantity' | 'status' | 'createdAt' | 'updatedAt'>
  ): Promise<DemandRequest> {
    const insertedDemands = await this.db
      .insert(demands)
      .values({
        buyerId: demand.buyerId,
        buyerName: demand.buyerName,
        cooperativeId: demand.cooperativeId ?? this.cooperativeId,
        cropId: demand.cropId,
        cropName: demand.cropName,
        quantity: demand.quantity.toString(),
        matchedQuantity: '0',
        minQualityGrade: demand.minQualityGrade as 'A' | 'B' | 'C' | 'D' | undefined,
        deliveryDateStart: demand.deliveryDateStart,
        deliveryDateEnd: demand.deliveryDateEnd,
        maxPricePerKg: demand.maxPricePerKg?.toString(),
        preferredRegion: demand.preferredRegion as
          | 'north'
          | 'central'
          | 'south'
          | 'east'
          | undefined,
        priority: demand.priority,
        status: 'pending',
        notes: demand.notes,
        expiresAt: demand.expiresAt,
      })
      .returning();

    const inserted = insertedDemands[0];
    if (!inserted) {
      throw new Error('Failed to create demand');
    }

    return this.mapToDemandRequest(inserted);
  }

  /**
   * Gets pending demands for the cooperative.
   */
  async getPendingDemands(): Promise<DemandRequest[]> {
    const results = await this.db
      .select()
      .from(demands)
      .where(
        and(
          eq(demands.cooperativeId, this.cooperativeId),
          or(eq(demands.status, 'pending'), eq(demands.status, 'partially_matched'))
        )
      )
      .orderBy(desc(demands.createdAt));

    return results.map((d) => this.mapToDemandRequest(d));
  }

  /**
   * Gets all demands for the cooperative.
   */
  async getAllDemands(): Promise<DemandRequest[]> {
    const results = await this.db
      .select()
      .from(demands)
      .where(eq(demands.cooperativeId, this.cooperativeId))
      .orderBy(desc(demands.createdAt));

    return results.map((d) => this.mapToDemandRequest(d));
  }

  /**
   * Gets a demand by ID.
   */
  async getDemandById(demandId: string): Promise<DemandRequest | null> {
    const [demand] = await this.db.select().from(demands).where(eq(demands.id, demandId)).limit(1);

    if (!demand) return null;
    return this.mapToDemandRequest(demand);
  }

  /**
   * Updates a demand's status.
   */
  async updateDemandStatus(
    demandId: string,
    status: DemandRequest['status'],
    matchedQuantity?: number
  ): Promise<DemandRequest | null> {
    const updateData: Record<string, unknown> = { status };
    if (matchedQuantity !== undefined) {
      updateData.matchedQuantity = matchedQuantity.toString();
    }

    const updatedDemands = await this.db
      .update(demands)
      .set(updateData)
      .where(eq(demands.id, demandId))
      .returning();

    const updated = updatedDemands[0];
    if (!updated) return null;
    return this.mapToDemandRequest(updated);
  }

  /**
   * Cancels a demand.
   */
  async cancelDemand(demandId: string): Promise<boolean> {
    const demand = await this.updateDemandStatus(demandId, 'cancelled');
    return demand !== null;
  }

  // ============================================
  // Supply Retrieval
  // ============================================

  /**
   * Gets available supply candidates for matching.
   */
  async getAvailableSupply(): Promise<SupplyCandidate[]> {
    const now = new Date();

    // Query active planting records with expected harvest in the future
    // Join with users to get farmer info and cooperative region
    const results = await this.db
      .select({
        plantingRecordId: plantingRecords.id,
        farmerId: plantingRecords.userId,
        farmerName: users.name,
        cropId: plantingRecords.cropId,
        cropName: plantingRecords.cropName,
        expectedYield: plantingRecords.expectedYield,
        expectedHarvestDate: plantingRecords.expectedHarvestDate,
        predictionConfidence: plantingRecords.predictionConfidence,
        region: cooperatives.region,
      })
      .from(plantingRecords)
      .innerJoin(users, eq(plantingRecords.userId, users.id))
      .innerJoin(cooperatives, eq(users.cooperativeId, cooperatives.id))
      .where(
        and(
          eq(plantingRecords.status, 'active'),
          gt(plantingRecords.expectedHarvestDate, now),
          eq(users.cooperativeId, this.cooperativeId)
        )
      );

    return results
      .filter((r) => r.expectedYield && r.expectedYield > 0 && r.expectedHarvestDate)
      .map((r) => ({
        plantingRecordId: r.plantingRecordId,
        farmerId: r.farmerId,
        farmerName: r.farmerName ?? 'Unknown',
        cropId: r.cropId,
        cropName: r.cropName,
        availableQuantity: r.expectedYield!,
        expectedHarvestDate: r.expectedHarvestDate!,
        expectedQualityGrade: 'B' as const, // Default, would need growth records for actual grade
        expectedPricePerKg: 30, // Default, would need price service for actual price
        region: (r.region as 'north' | 'central' | 'south' | 'east') ?? 'central',
        predictionConfidence: r.predictionConfidence ?? 0.8,
      }));
  }

  /**
   * Gets supply candidates for a specific crop.
   */
  async getSupplyForCrop(cropId: string): Promise<SupplyCandidate[]> {
    const allSupply = await this.getAvailableSupply();
    return allSupply.filter((s) => s.cropId === cropId);
  }

  // ============================================
  // Matching Operations
  // ============================================

  /**
   * Finds matching suggestions for a demand.
   */
  async findMatchesForDemand(demandId: string): Promise<MatchSuggestion | null> {
    const demand = await this.getDemandById(demandId);
    if (!demand) return null;

    const supply = await this.getSupplyForCrop(demand.cropId);
    const rankedCandidates = rankSupplyCandidates(supply, demand, {
      minScore: this.config.minMatchScore,
      maxResults: this.config.maxSuggestionsPerDemand,
      weights: this.config.weights,
    });

    const totalAvailableQuantity = rankedCandidates.reduce(
      (sum, c) => sum + c.availableQuantity,
      0
    );

    const remainingQuantity = demand.quantity - demand.matchedQuantity;
    const canFully = canFullyMatch(rankedCandidates, remainingQuantity);

    return {
      demand,
      matches: rankedCandidates.map((c) => ({
        plantingRecordId: c.plantingRecordId,
        farmerId: c.farmerId,
        farmerName: c.farmerName,
        availableQuantity: c.availableQuantity,
        expectedHarvestDate: c.expectedHarvestDate,
        expectedQualityGrade: c.expectedQualityGrade,
        score: c.score,
        region: c.region,
      })),
      totalAvailableQuantity,
      canFullyMatch: canFully,
    };
  }

  /**
   * Finds matching suggestions for all pending demands.
   */
  async findAllMatchSuggestions(): Promise<MatchSuggestion[]> {
    const pendingDemands = await this.getPendingDemands();
    const suggestions: MatchSuggestion[] = [];

    for (const demand of pendingDemands) {
      const suggestion = await this.findMatchesForDemand(demand.id);
      if (suggestion && suggestion.matches.length > 0) {
        suggestions.push(suggestion);
      }
    }

    // Sort by priority and then by whether can fully match
    return suggestions.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const aPriority = priorityOrder[a.demand.priority];
      const bPriority = priorityOrder[b.demand.priority];

      if (aPriority !== bPriority) return aPriority - bPriority;
      if (a.canFullyMatch !== b.canFullyMatch) return a.canFullyMatch ? -1 : 1;
      return 0;
    });
  }

  /**
   * Creates matches from a suggestion.
   * Selects optimal supply allocation for the demand.
   */
  async createMatchesFromSuggestion(
    demandId: string,
    selectedPlantingRecordIds?: string[]
  ): Promise<SupplyDemandMatch[]> {
    const suggestion = await this.findMatchesForDemand(demandId);
    if (!suggestion) {
      throw new Error(`Demand ${demandId} not found`);
    }

    // Filter to selected candidates if specified
    let candidates = suggestion.matches;
    if (selectedPlantingRecordIds && selectedPlantingRecordIds.length > 0) {
      candidates = candidates.filter((c) => selectedPlantingRecordIds.includes(c.plantingRecordId));
    }

    // Convert to supply candidates for optimal selection
    const supplyCandidates = candidates.map((c) => ({
      ...c,
      cropId: suggestion.demand.cropId,
      cropName: suggestion.demand.cropName,
      predictionConfidence: 0.8, // Default confidence
    }));

    const remainingQuantity = suggestion.demand.quantity - suggestion.demand.matchedQuantity;

    // Select optimal allocation
    const allocations = selectOptimalSupply(
      supplyCandidates as Array<SupplyCandidate & { score: MatchScore }>,
      remainingQuantity
    );

    // Create match records in database
    const createdMatches: SupplyDemandMatch[] = [];

    for (const allocation of allocations) {
      const insertedMatches = await this.db
        .insert(matches)
        .values({
          demandId,
          plantingRecordId: allocation.plantingRecordId,
          farmerId: allocation.farmerId,
          farmerName: allocation.farmerName,
          cooperativeId: this.cooperativeId,
          cropId: suggestion.demand.cropId,
          cropName: suggestion.demand.cropName,
          quantity: allocation.allocatedQuantity.toString(),
          expectedHarvestDate: allocation.expectedHarvestDate,
          expectedQualityGrade: allocation.expectedQualityGrade as 'A' | 'B' | 'C' | 'D',
          score: {
            overall: allocation.score.overall,
            cropMatch: allocation.score.cropMatch,
            quantityMatch: allocation.score.quantityMatch,
            dateMatch: allocation.score.dateMatch,
            priceMatch: allocation.score.priceMatch,
            qualityMatch: allocation.score.qualityMatch,
            regionMatch: allocation.score.regionMatch,
          },
          status: 'suggested',
        })
        .returning();

      const inserted = insertedMatches[0];
      if (inserted) {
        createdMatches.push(this.mapToSupplyDemandMatch(inserted));
      }
    }

    // Update demand matched quantity
    const totalMatched =
      suggestion.demand.matchedQuantity +
      allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);

    const newStatus =
      totalMatched >= suggestion.demand.quantity
        ? 'matched'
        : totalMatched > 0
          ? 'partially_matched'
          : 'pending';

    await this.updateDemandStatus(demandId, newStatus, totalMatched);

    return createdMatches;
  }

  // ============================================
  // Statistics and Reporting
  // ============================================

  /**
   * Gets matching summary for the cooperative.
   */
  async getMatchingSummary(periodStart: Date, periodEnd: Date): Promise<MatchingSummary> {
    // Get demands in period
    const periodDemands = await this.db
      .select()
      .from(demands)
      .where(
        and(
          eq(demands.cooperativeId, this.cooperativeId),
          gte(demands.createdAt, periodStart),
          lte(demands.createdAt, periodEnd)
        )
      );

    // Count by status
    const statusCounts = {
      pending: 0,
      partially_matched: 0,
      matched: 0,
      fulfilled: 0,
      expired: 0,
      cancelled: 0,
    };

    for (const demand of periodDemands) {
      statusCounts[demand.status as keyof typeof statusCounts]++;
    }

    // Aggregate by crop
    const cropStats = new Map<
      string,
      { cropName: string; matchCount: number; totalQuantity: number }
    >();

    for (const demand of periodDemands) {
      const matchedQty = parseFloat(demand.matchedQuantity);
      if (matchedQty > 0) {
        const existing = cropStats.get(demand.cropId) ?? {
          cropName: demand.cropName,
          matchCount: 0,
          totalQuantity: 0,
        };
        existing.matchCount++;
        existing.totalQuantity += matchedQty;
        cropStats.set(demand.cropId, existing);
      }
    }

    const topCrops = Array.from(cropStats.entries())
      .map(([cropId, stats]) => ({
        cropId,
        cropName: stats.cropName,
        matchCount: stats.matchCount,
        totalQuantity: stats.totalQuantity,
      }))
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5);

    const matchedCount = statusCounts.matched + statusCounts.fulfilled;
    const totalWithMatches = statusCounts.partially_matched + matchedCount;
    const totalQuantityMatched = periodDemands.reduce(
      (sum, d) => sum + parseFloat(d.matchedQuantity),
      0
    );

    return {
      cooperativeId: this.cooperativeId,
      periodStart,
      periodEnd,
      totalDemands: periodDemands.length,
      pendingDemands: statusCounts.pending,
      matchedDemands: matchedCount,
      fulfilledDemands: statusCounts.fulfilled,
      totalMatches: totalWithMatches,
      acceptedMatches: matchedCount, // Simplified for now
      successRate: periodDemands.length > 0 ? matchedCount / periodDemands.length : 0,
      totalQuantityMatched,
      topCrops,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a database demand record to DemandRequest type.
   */
  private mapToDemandRequest(record: {
    id: string;
    buyerId: string;
    buyerName: string | null;
    cooperativeId: string | null;
    cropId: string;
    cropName: string;
    quantity: string;
    matchedQuantity: string;
    minQualityGrade: string | null;
    deliveryDateStart: Date;
    deliveryDateEnd: Date;
    maxPricePerKg: string | null;
    preferredRegion: string | null;
    priority: string;
    status: string;
    notes: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): DemandRequest {
    return {
      id: record.id,
      buyerId: record.buyerId,
      buyerName: record.buyerName ?? undefined,
      cooperativeId: record.cooperativeId ?? undefined,
      cropId: record.cropId,
      cropName: record.cropName,
      quantity: parseFloat(record.quantity),
      matchedQuantity: parseFloat(record.matchedQuantity),
      minQualityGrade: record.minQualityGrade as 'A' | 'B' | 'C' | 'D' | undefined,
      deliveryDateStart: record.deliveryDateStart,
      deliveryDateEnd: record.deliveryDateEnd,
      maxPricePerKg: record.maxPricePerKg ? parseFloat(record.maxPricePerKg) : undefined,
      preferredRegion: record.preferredRegion as 'north' | 'central' | 'south' | 'east' | undefined,
      priority: record.priority as 'low' | 'medium' | 'high' | 'urgent',
      status: record.status as DemandRequest['status'],
      notes: record.notes ?? undefined,
      expiresAt: record.expiresAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Maps a database match record to SupplyDemandMatch type.
   */
  private mapToSupplyDemandMatch(record: {
    id: string;
    demandId: string;
    plantingRecordId: string;
    farmerId: string;
    farmerName: string | null;
    cooperativeId: string;
    cropId: string;
    cropName: string;
    quantity: string;
    expectedHarvestDate: Date;
    expectedQualityGrade: string | null;
    score: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): SupplyDemandMatch {
    const scoreData = record.score as {
      overall: number;
      cropMatch: number;
      quantityMatch: number;
      dateMatch: number;
      priceMatch?: number;
      qualityMatch?: number;
      regionMatch?: number;
    };

    return {
      id: record.id,
      demandId: record.demandId,
      plantingRecordId: record.plantingRecordId,
      farmerId: record.farmerId,
      farmerName: record.farmerName ?? undefined,
      cooperativeId: record.cooperativeId,
      cropId: record.cropId,
      cropName: record.cropName,
      quantity: parseFloat(record.quantity),
      expectedHarvestDate: record.expectedHarvestDate,
      expectedQualityGrade: record.expectedQualityGrade as 'A' | 'B' | 'C' | 'D' | undefined,
      score: {
        overall: scoreData.overall,
        cropMatch: scoreData.cropMatch,
        quantityMatch: scoreData.quantityMatch,
        dateMatch: scoreData.dateMatch,
        priceMatch: scoreData.priceMatch ?? 0,
        qualityMatch: scoreData.qualityMatch ?? 0,
        regionMatch: scoreData.regionMatch ?? 0,
      },
      status: record.status as SupplyDemandMatch['status'],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

/**
 * Factory function to create a matching service.
 */
export function createMatchingService(
  cooperativeId: string,
  config?: MatchingServiceConfig,
  db?: Database
): MatchingService {
  return new MatchingService(cooperativeId, config, db);
}
