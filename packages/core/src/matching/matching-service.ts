/**
 * Matching Service
 *
 * Service for managing supply-demand matching operations.
 * Coordinates between demands, supply, and match creation.
 */

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
 * Mock data for supply candidates.
 * TODO: Replace with database queries in production.
 */
const MOCK_SUPPLY: SupplyCandidate[] = [
  {
    plantingRecordId: 'pr_001',
    farmerId: 'farmer_001',
    farmerName: '王大明',
    cropId: 'bok-choy',
    cropName: '小白菜',
    availableQuantity: 150,
    expectedHarvestDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    expectedQualityGrade: 'A',
    expectedPricePerKg: 35,
    region: 'central',
    predictionConfidence: 0.85,
  },
  {
    plantingRecordId: 'pr_002',
    farmerId: 'farmer_002',
    farmerName: '李小華',
    cropId: 'bok-choy',
    cropName: '小白菜',
    availableQuantity: 80,
    expectedHarvestDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    expectedQualityGrade: 'B',
    expectedPricePerKg: 30,
    region: 'north',
    predictionConfidence: 0.78,
  },
  {
    plantingRecordId: 'pr_003',
    farmerId: 'farmer_003',
    farmerName: '張阿國',
    cropId: 'tomato',
    cropName: '番茄',
    availableQuantity: 200,
    expectedHarvestDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    expectedQualityGrade: 'A',
    expectedPricePerKg: 45,
    region: 'south',
    predictionConfidence: 0.82,
  },
  {
    plantingRecordId: 'pr_004',
    farmerId: 'farmer_001',
    farmerName: '王大明',
    cropId: 'cabbage',
    cropName: '高麗菜',
    availableQuantity: 300,
    expectedHarvestDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    expectedQualityGrade: 'A',
    expectedPricePerKg: 25,
    region: 'central',
    predictionConfidence: 0.88,
  },
];

/**
 * Mock demands for testing.
 * TODO: Replace with database queries in production.
 */
const MOCK_DEMANDS: DemandRequest[] = [];
let demandIdCounter = 1;

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

  constructor(cooperativeId: string, config?: MatchingServiceConfig) {
    this.cooperativeId = cooperativeId;
    this.config = { ...DEFAULT_CONFIG, ...config };
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
    const now = new Date();
    const newDemand: DemandRequest = {
      ...demand,
      id: `demand_${demandIdCounter++}`,
      matchedQuantity: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    MOCK_DEMANDS.push(newDemand);
    return newDemand;
  }

  /**
   * Gets pending demands for the cooperative.
   */
  async getPendingDemands(): Promise<DemandRequest[]> {
    return MOCK_DEMANDS.filter(
      (d) =>
        d.cooperativeId === this.cooperativeId &&
        (d.status === 'pending' || d.status === 'partially_matched')
    );
  }

  /**
   * Gets all demands for the cooperative.
   */
  async getAllDemands(): Promise<DemandRequest[]> {
    return MOCK_DEMANDS.filter((d) => d.cooperativeId === this.cooperativeId);
  }

  /**
   * Gets a demand by ID.
   */
  async getDemandById(demandId: string): Promise<DemandRequest | null> {
    return MOCK_DEMANDS.find((d) => d.id === demandId) ?? null;
  }

  /**
   * Updates a demand's status.
   */
  async updateDemandStatus(
    demandId: string,
    status: DemandRequest['status'],
    matchedQuantity?: number
  ): Promise<DemandRequest | null> {
    const demand = MOCK_DEMANDS.find((d) => d.id === demandId);
    if (!demand) return null;

    demand.status = status;
    if (matchedQuantity !== undefined) {
      demand.matchedQuantity = matchedQuantity;
    }
    demand.updatedAt = new Date();

    return demand;
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
   * TODO: Replace with database query.
   */
  async getAvailableSupply(): Promise<SupplyCandidate[]> {
    // In production, this would query active planting records
    // with expectedHarvestDate in the near future
    return MOCK_SUPPLY.filter((s) => s.availableQuantity > 0 && s.expectedHarvestDate > new Date());
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

    // Create match records
    const now = new Date();
    const matches: SupplyDemandMatch[] = allocations.map((allocation, index) => ({
      id: `match_${demandId}_${index}`,
      demandId,
      plantingRecordId: allocation.plantingRecordId,
      farmerId: allocation.farmerId,
      farmerName: allocation.farmerName,
      cooperativeId: this.cooperativeId,
      cropId: suggestion.demand.cropId,
      cropName: suggestion.demand.cropName,
      quantity: allocation.allocatedQuantity,
      expectedHarvestDate: allocation.expectedHarvestDate,
      expectedQualityGrade: allocation.expectedQualityGrade,
      score: allocation.score,
      status: 'suggested',
      createdAt: now,
      updatedAt: now,
    }));

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

    return matches;
  }

  // ============================================
  // Statistics and Reporting
  // ============================================

  /**
   * Gets matching summary for the cooperative.
   */
  async getMatchingSummary(periodStart: Date, periodEnd: Date): Promise<MatchingSummary> {
    const allDemands = await this.getAllDemands();
    const periodDemands = allDemands.filter(
      (d) => d.createdAt >= periodStart && d.createdAt <= periodEnd
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
      statusCounts[demand.status]++;
    }

    // Aggregate by crop
    const cropStats = new Map<
      string,
      { cropName: string; matchCount: number; totalQuantity: number }
    >();

    for (const demand of periodDemands) {
      if (demand.matchedQuantity > 0) {
        const existing = cropStats.get(demand.cropId) ?? {
          cropName: demand.cropName,
          matchCount: 0,
          totalQuantity: 0,
        };
        existing.matchCount++;
        existing.totalQuantity += demand.matchedQuantity;
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
      totalQuantityMatched: periodDemands.reduce((sum, d) => sum + d.matchedQuantity, 0),
      topCrops,
    };
  }
}

/**
 * Factory function to create a matching service.
 */
export function createMatchingService(
  cooperativeId: string,
  config?: MatchingServiceConfig
): MatchingService {
  return new MatchingService(cooperativeId, config);
}
