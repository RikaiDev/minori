/**
 * Supply-Demand Matching Algorithm
 *
 * Calculates match scores between farmer supply and buyer demand.
 * Uses weighted scoring across multiple criteria.
 */

import type { MatchScore, DemandRequest, TaiwanRegion } from '@minori/shared';

/**
 * Supply item for matching (from planting records).
 */
export interface SupplyCandidate {
  /** Planting record ID */
  plantingRecordId: string;
  /** Farmer user ID */
  farmerId: string;
  /** Farmer name */
  farmerName: string;
  /** Crop ID */
  cropId: string;
  /** Crop name */
  cropName: string;
  /** Available quantity in kg */
  availableQuantity: number;
  /** Expected harvest date */
  expectedHarvestDate: Date;
  /** Expected quality grade */
  expectedQualityGrade?: 'A' | 'B' | 'C' | 'D';
  /** Expected price per kg (market or farmer's asking) */
  expectedPricePerKg?: number;
  /** Farmer's region */
  region?: TaiwanRegion;
  /** Prediction confidence (0-1) */
  predictionConfidence: number;
}

/**
 * Weights for different matching criteria.
 */
export interface MatchingWeights {
  /** Weight for crop type match (0-1) */
  crop: number;
  /** Weight for quantity match (0-1) */
  quantity: number;
  /** Weight for date match (0-1) */
  date: number;
  /** Weight for price match (0-1) */
  price: number;
  /** Weight for quality match (0-1) */
  quality: number;
  /** Weight for region match (0-1) */
  region: number;
}

/**
 * Default weights for matching criteria.
 * Crop and date are most important, followed by quantity.
 */
export const DEFAULT_WEIGHTS: MatchingWeights = {
  crop: 1.0, // Crop match is essential (must match)
  quantity: 0.25, // Quantity availability
  date: 0.3, // Delivery timing
  price: 0.15, // Price compatibility
  quality: 0.15, // Quality requirements
  region: 0.15, // Region preference
};

/**
 * Quality grade order for comparison (higher index = better quality).
 */
const QUALITY_GRADES = ['D', 'C', 'B', 'A'] as const;

/**
 * Calculates the match score between a supply candidate and a demand request.
 *
 * @param supply - Supply candidate from a farmer
 * @param demand - Demand request from a buyer
 * @param weights - Optional custom weights for scoring
 * @returns Match score breakdown
 */
export function calculateMatchScore(
  supply: SupplyCandidate,
  demand: DemandRequest,
  weights: MatchingWeights = DEFAULT_WEIGHTS
): MatchScore {
  // Calculate individual scores
  const cropMatch = calculateCropScore(supply.cropId, demand.cropId);
  const quantityMatch = calculateQuantityScore(
    supply.availableQuantity,
    demand.quantity - demand.matchedQuantity
  );
  const dateMatch = calculateDateScore(
    supply.expectedHarvestDate,
    demand.deliveryDateStart,
    demand.deliveryDateEnd
  );
  const priceMatch = calculatePriceScore(supply.expectedPricePerKg, demand.maxPricePerKg);
  const qualityMatch = calculateQualityScore(supply.expectedQualityGrade, demand.minQualityGrade);
  const regionMatch = calculateRegionScore(supply.region, demand.preferredRegion);

  // Calculate weighted overall score
  // Crop match is a gate - if it's 0, overall is 0
  if (cropMatch === 0) {
    return {
      overall: 0,
      cropMatch: 0,
      quantityMatch,
      dateMatch,
      priceMatch,
      qualityMatch,
      regionMatch,
    };
  }

  // Calculate the sum of applicable weights
  let totalWeight = weights.quantity + weights.date;
  let weightedSum = quantityMatch * weights.quantity + dateMatch * weights.date;

  // Add optional criteria if they're specified in the demand
  if (demand.maxPricePerKg !== undefined && priceMatch !== undefined) {
    totalWeight += weights.price;
    weightedSum += priceMatch * weights.price;
  }

  if (demand.minQualityGrade !== undefined && qualityMatch !== undefined) {
    totalWeight += weights.quality;
    weightedSum += qualityMatch * weights.quality;
  }

  if (demand.preferredRegion !== undefined && regionMatch !== undefined) {
    totalWeight += weights.region;
    weightedSum += regionMatch * weights.region;
  }

  // Calculate weighted average (scores are already 0-100)
  const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return {
    overall,
    cropMatch,
    quantityMatch,
    dateMatch,
    priceMatch,
    qualityMatch,
    regionMatch,
  };
}

/**
 * Calculates crop match score.
 * Only exact matches are valid - partial matches not supported.
 *
 * @returns 100 if crops match, 0 otherwise
 */
function calculateCropScore(supplyCropId: string, demandCropId: string): number {
  return supplyCropId === demandCropId ? 100 : 0;
}

/**
 * Calculates quantity match score.
 * Higher score if supply can fully cover remaining demand.
 *
 * @param supplyQuantity - Available supply quantity in kg
 * @param remainingDemand - Remaining quantity needed (demand - matched)
 * @returns Score 0-100
 */
function calculateQuantityScore(supplyQuantity: number, remainingDemand: number): number {
  if (remainingDemand <= 0) return 100; // Demand already fulfilled
  if (supplyQuantity <= 0) return 0;

  // Calculate coverage ratio
  const coverageRatio = supplyQuantity / remainingDemand;

  if (coverageRatio >= 1) {
    // Can fully cover - perfect score
    return 100;
  } else if (coverageRatio >= 0.5) {
    // Can cover at least half - good score
    return Math.round(50 + coverageRatio * 50);
  } else {
    // Less than half coverage - scaled lower
    return Math.round(coverageRatio * 100);
  }
}

/**
 * Calculates date match score.
 * Higher score if harvest date falls within delivery window.
 *
 * @param harvestDate - Expected harvest date
 * @param deliveryStart - Earliest acceptable delivery date
 * @param deliveryEnd - Latest acceptable delivery date
 * @returns Score 0-100
 */
function calculateDateScore(harvestDate: Date, deliveryStart: Date, deliveryEnd: Date): number {
  const harvestTime = harvestDate.getTime();
  const startTime = deliveryStart.getTime();
  const endTime = deliveryEnd.getTime();

  // Perfect match: harvest falls within delivery window
  if (harvestTime >= startTime && harvestTime <= endTime) {
    // Score based on how centered within the window
    const windowSize = endTime - startTime;
    const position = harvestTime - startTime;

    // Prefer earlier dates within the window (more buffer for delays)
    // First third of window = 100, decreasing slightly toward end
    if (windowSize === 0) return 100;
    const normalizedPosition = position / windowSize;
    return Math.round(100 - normalizedPosition * 15); // 100 -> 85 across window
  }

  // Harvest before delivery window start
  if (harvestTime < startTime) {
    const daysEarly = (startTime - harvestTime) / (1000 * 60 * 60 * 24);
    if (daysEarly <= 3) {
      // 1-3 days early is acceptable with storage
      return Math.round(80 - daysEarly * 10); // 70-80
    } else if (daysEarly <= 7) {
      // 4-7 days early needs planning
      return Math.round(50 - (daysEarly - 3) * 10); // 20-50
    }
    return 0; // Too early
  }

  // Harvest after delivery window end
  const daysLate = (harvestTime - endTime) / (1000 * 60 * 60 * 24);
  if (daysLate <= 3) {
    // 1-3 days late might be acceptable
    return Math.round(50 - daysLate * 15); // 5-50
  }
  return 0; // Too late
}

/**
 * Calculates price match score.
 * Higher score if supply price is at or below buyer's max price.
 *
 * @param supplyPrice - Expected price per kg (if available)
 * @param maxPrice - Buyer's maximum price per kg (if specified)
 * @returns Score 0-100 or undefined if not applicable
 */
function calculatePriceScore(supplyPrice?: number, maxPrice?: number): number | undefined {
  // If either is not specified, price is not a criterion
  if (supplyPrice === undefined || maxPrice === undefined) {
    return undefined;
  }

  if (supplyPrice <= maxPrice) {
    // Under or at budget - excellent
    // Bonus for being well under budget
    const savings = (maxPrice - supplyPrice) / maxPrice;
    return Math.round(Math.min(100, 80 + savings * 40));
  }

  // Over budget
  const overageRatio = (supplyPrice - maxPrice) / maxPrice;
  if (overageRatio <= 0.1) {
    // Up to 10% over - might be negotiable
    return Math.round(60 - overageRatio * 200); // 40-60
  } else if (overageRatio <= 0.25) {
    // 10-25% over - less likely
    return Math.round(30 - (overageRatio - 0.1) * 100); // 15-30
  }
  return 0; // Too expensive
}

/**
 * Calculates quality match score.
 * Higher score if supply quality meets or exceeds minimum requirement.
 *
 * @param supplyQuality - Expected quality grade
 * @param minQuality - Minimum acceptable quality grade
 * @returns Score 0-100 or undefined if not applicable
 */
function calculateQualityScore(
  supplyQuality?: 'A' | 'B' | 'C' | 'D',
  minQuality?: 'A' | 'B' | 'C' | 'D'
): number | undefined {
  // If quality not specified, not a criterion
  if (supplyQuality === undefined || minQuality === undefined) {
    return undefined;
  }

  const supplyIndex = QUALITY_GRADES.indexOf(supplyQuality);
  const minIndex = QUALITY_GRADES.indexOf(minQuality);

  if (supplyIndex >= minIndex) {
    // Meets or exceeds requirement
    // Bonus for exceeding
    const gradesAbove = supplyIndex - minIndex;
    return Math.min(100, 80 + gradesAbove * 10);
  }

  // Below requirement
  const gradesBelow = minIndex - supplyIndex;
  if (gradesBelow === 1) {
    // One grade below - might be acceptable
    return 40;
  }
  return 0; // Too far below requirement
}

/**
 * Calculates region match score.
 * Higher score if supply region matches preference.
 *
 * @param supplyRegion - Farmer's region
 * @param preferredRegion - Buyer's preferred region
 * @returns Score 0-100 or undefined if not applicable
 */
function calculateRegionScore(
  supplyRegion?: TaiwanRegion,
  preferredRegion?: TaiwanRegion
): number | undefined {
  // If region not specified, not a criterion
  if (supplyRegion === undefined || preferredRegion === undefined) {
    return undefined;
  }

  if (supplyRegion === preferredRegion) {
    return 100;
  }

  // Adjacent regions get a partial score
  // Taiwan region adjacency: north-central, central-south, east touches all
  const adjacentRegions: Record<TaiwanRegion, TaiwanRegion[]> = {
    north: ['central', 'east'],
    central: ['north', 'south', 'east'],
    south: ['central', 'east'],
    east: ['north', 'central', 'south'],
  };

  if (adjacentRegions[supplyRegion]?.includes(preferredRegion)) {
    return 60; // Adjacent region - acceptable
  }

  return 30; // Different region - lower priority
}

/**
 * Filters and ranks supply candidates for a demand.
 *
 * @param candidates - All available supply candidates
 * @param demand - The demand to match against
 * @param options - Filtering options
 * @returns Ranked list of candidates with scores
 */
export function rankSupplyCandidates(
  candidates: SupplyCandidate[],
  demand: DemandRequest,
  options: {
    minScore?: number;
    maxResults?: number;
    weights?: MatchingWeights;
  } = {}
): Array<SupplyCandidate & { score: MatchScore }> {
  const { minScore = 30, maxResults = 10, weights } = options;

  // Calculate scores for all candidates
  const scoredCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      score: calculateMatchScore(candidate, demand, weights),
    }))
    // Filter by minimum score
    .filter((c) => c.score.overall >= minScore)
    // Sort by overall score descending
    .sort((a, b) => b.score.overall - a.score.overall);

  // Limit results
  return scoredCandidates.slice(0, maxResults);
}

/**
 * Checks if a demand can be fully matched by available supply.
 *
 * @param candidates - Ranked supply candidates
 * @param remainingQuantity - Remaining quantity needed
 * @returns Whether demand can be fully satisfied
 */
export function canFullyMatch(
  candidates: Array<SupplyCandidate & { score: MatchScore }>,
  remainingQuantity: number
): boolean {
  const totalAvailable = candidates.reduce((sum, c) => sum + c.availableQuantity, 0);
  return totalAvailable >= remainingQuantity;
}

/**
 * Selects optimal combination of supply to fulfill demand.
 * Uses a greedy algorithm prioritizing score, then quantity coverage.
 *
 * @param candidates - Ranked supply candidates
 * @param targetQuantity - Target quantity to fulfill
 * @returns Selected candidates with allocated quantities
 */
export function selectOptimalSupply(
  candidates: Array<SupplyCandidate & { score: MatchScore }>,
  targetQuantity: number
): Array<SupplyCandidate & { score: MatchScore; allocatedQuantity: number }> {
  const selected: Array<SupplyCandidate & { score: MatchScore; allocatedQuantity: number }> = [];
  let remaining = targetQuantity;

  // Greedy selection - take from highest scored first
  for (const candidate of candidates) {
    if (remaining <= 0) break;

    const toAllocate = Math.min(candidate.availableQuantity, remaining);
    if (toAllocate > 0) {
      selected.push({
        ...candidate,
        allocatedQuantity: toAllocate,
      });
      remaining -= toAllocate;
    }
  }

  return selected;
}
