/**
 * Tests for matching algorithm.
 */

import { describe, expect, test } from 'bun:test';
import {
  calculateMatchScore,
  rankSupplyCandidates,
  canFullyMatch,
  selectOptimalSupply,
  type SupplyCandidate,
} from './matching-algorithm';
import type { DemandRequest, MatchScore } from '@minori/shared';

// Helper to create a mock score
function createMockScore(overall: number): MatchScore {
  return {
    overall,
    cropMatch: 100,
    quantityMatch: 100,
    dateMatch: 100,
  };
}

// Helper to create a base demand
function createDemand(overrides: Partial<DemandRequest> = {}): DemandRequest {
  const now = new Date();
  return {
    id: 'demand_1',
    buyerId: 'buyer_1',
    cropId: 'bok-choy',
    cropName: '小白菜',
    quantity: 100,
    matchedQuantity: 0,
    deliveryDateStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
    deliveryDateEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    priority: 'medium',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// Helper to create a base supply candidate
function createSupply(overrides: Partial<SupplyCandidate> = {}): SupplyCandidate {
  const now = new Date();
  return {
    plantingRecordId: 'pr_1',
    farmerId: 'farmer_1',
    farmerName: '王大明',
    cropId: 'bok-choy',
    cropName: '小白菜',
    availableQuantity: 100,
    expectedHarvestDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    predictionConfidence: 0.85,
    ...overrides,
  };
}

describe('calculateMatchScore', () => {
  describe('crop matching', () => {
    test('gives 100 for exact crop match', () => {
      const supply = createSupply({ cropId: 'bok-choy' });
      const demand = createDemand({ cropId: 'bok-choy' });
      const score = calculateMatchScore(supply, demand);

      expect(score.cropMatch).toBe(100);
      expect(score.overall).toBeGreaterThan(0);
    });

    test('gives 0 for crop mismatch', () => {
      const supply = createSupply({ cropId: 'tomato' });
      const demand = createDemand({ cropId: 'bok-choy' });
      const score = calculateMatchScore(supply, demand);

      expect(score.cropMatch).toBe(0);
      expect(score.overall).toBe(0);
    });
  });

  describe('quantity matching', () => {
    test('gives 100 when supply fully covers demand', () => {
      const supply = createSupply({ availableQuantity: 150 });
      const demand = createDemand({ quantity: 100, matchedQuantity: 0 });
      const score = calculateMatchScore(supply, demand);

      expect(score.quantityMatch).toBe(100);
    });

    test('gives 100 when supply exactly matches remaining demand', () => {
      const supply = createSupply({ availableQuantity: 50 });
      const demand = createDemand({ quantity: 100, matchedQuantity: 50 });
      const score = calculateMatchScore(supply, demand);

      expect(score.quantityMatch).toBe(100);
    });

    test('gives partial score for partial coverage', () => {
      const supply = createSupply({ availableQuantity: 30 });
      const demand = createDemand({ quantity: 100, matchedQuantity: 0 });
      const score = calculateMatchScore(supply, demand);

      expect(score.quantityMatch).toBeLessThan(100);
      expect(score.quantityMatch).toBeGreaterThan(0);
    });

    test('gives 0 for zero supply', () => {
      const supply = createSupply({ availableQuantity: 0 });
      const demand = createDemand({ quantity: 100 });
      const score = calculateMatchScore(supply, demand);

      expect(score.quantityMatch).toBe(0);
    });
  });

  describe('date matching', () => {
    test('gives high score when harvest is within delivery window', () => {
      const now = new Date();
      const supply = createSupply({
        expectedHarvestDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      });
      const demand = createDemand({
        deliveryDateStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        deliveryDateEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      });
      const score = calculateMatchScore(supply, demand);

      expect(score.dateMatch).toBeGreaterThanOrEqual(85);
    });

    test('gives lower score when harvest is slightly early', () => {
      const now = new Date();
      const supply = createSupply({
        expectedHarvestDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      });
      const demand = createDemand({
        deliveryDateStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        deliveryDateEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      });
      const score = calculateMatchScore(supply, demand);

      expect(score.dateMatch).toBeLessThan(85);
      expect(score.dateMatch).toBeGreaterThan(50);
    });

    test('gives 0 when harvest is too early', () => {
      const now = new Date();
      const supply = createSupply({
        expectedHarvestDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      });
      const demand = createDemand({
        deliveryDateStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        deliveryDateEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      });
      const score = calculateMatchScore(supply, demand);

      expect(score.dateMatch).toBe(0);
    });

    test('gives 0 when harvest is too late', () => {
      const now = new Date();
      const supply = createSupply({
        expectedHarvestDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      });
      const demand = createDemand({
        deliveryDateStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        deliveryDateEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      });
      const score = calculateMatchScore(supply, demand);

      expect(score.dateMatch).toBe(0);
    });
  });

  describe('price matching', () => {
    test('returns undefined when price not specified', () => {
      const supply = createSupply();
      const demand = createDemand();
      const score = calculateMatchScore(supply, demand);

      expect(score.priceMatch).toBeUndefined();
    });

    test('gives high score when supply price is under budget', () => {
      const supply = createSupply({ expectedPricePerKg: 30 });
      const demand = createDemand({ maxPricePerKg: 40 });
      const score = calculateMatchScore(supply, demand);

      expect(score.priceMatch).toBeGreaterThanOrEqual(80);
    });

    test('gives lower score when supply price exceeds budget slightly', () => {
      const supply = createSupply({ expectedPricePerKg: 42 });
      const demand = createDemand({ maxPricePerKg: 40 });
      const score = calculateMatchScore(supply, demand);

      expect(score.priceMatch).toBeLessThan(80);
      expect(score.priceMatch).toBeGreaterThan(30);
    });

    test('gives 0 when supply price far exceeds budget', () => {
      const supply = createSupply({ expectedPricePerKg: 60 });
      const demand = createDemand({ maxPricePerKg: 40 });
      const score = calculateMatchScore(supply, demand);

      expect(score.priceMatch).toBe(0);
    });
  });

  describe('quality matching', () => {
    test('returns undefined when quality not specified', () => {
      const supply = createSupply();
      const demand = createDemand();
      const score = calculateMatchScore(supply, demand);

      expect(score.qualityMatch).toBeUndefined();
    });

    test('gives high score when supply meets quality requirement', () => {
      const supply = createSupply({ expectedQualityGrade: 'A' });
      const demand = createDemand({ minQualityGrade: 'B' });
      const score = calculateMatchScore(supply, demand);

      expect(score.qualityMatch).toBeGreaterThanOrEqual(80);
    });

    test('gives lower score when supply is one grade below', () => {
      const supply = createSupply({ expectedQualityGrade: 'B' });
      const demand = createDemand({ minQualityGrade: 'A' });
      const score = calculateMatchScore(supply, demand);

      expect(score.qualityMatch).toBe(40);
    });

    test('gives 0 when supply is far below requirement', () => {
      const supply = createSupply({ expectedQualityGrade: 'D' });
      const demand = createDemand({ minQualityGrade: 'A' });
      const score = calculateMatchScore(supply, demand);

      expect(score.qualityMatch).toBe(0);
    });
  });

  describe('region matching', () => {
    test('returns undefined when region not specified', () => {
      const supply = createSupply();
      const demand = createDemand();
      const score = calculateMatchScore(supply, demand);

      expect(score.regionMatch).toBeUndefined();
    });

    test('gives 100 for exact region match', () => {
      const supply = createSupply({ region: 'central' });
      const demand = createDemand({ preferredRegion: 'central' });
      const score = calculateMatchScore(supply, demand);

      expect(score.regionMatch).toBe(100);
    });

    test('gives partial score for adjacent region', () => {
      const supply = createSupply({ region: 'north' });
      const demand = createDemand({ preferredRegion: 'central' });
      const score = calculateMatchScore(supply, demand);

      expect(score.regionMatch).toBe(60);
    });

    test('gives low score for non-adjacent region', () => {
      const supply = createSupply({ region: 'south' });
      const demand = createDemand({ preferredRegion: 'north' });
      const score = calculateMatchScore(supply, demand);

      expect(score.regionMatch).toBe(30);
    });
  });

  describe('overall score calculation', () => {
    test('calculates weighted overall score', () => {
      const supply = createSupply({
        cropId: 'bok-choy',
        availableQuantity: 100,
        expectedPricePerKg: 35,
        expectedQualityGrade: 'A',
        region: 'central',
      });
      const demand = createDemand({
        cropId: 'bok-choy',
        quantity: 100,
        maxPricePerKg: 40,
        minQualityGrade: 'B',
        preferredRegion: 'central',
      });
      const score = calculateMatchScore(supply, demand);

      expect(score.overall).toBeGreaterThan(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });
  });
});

describe('rankSupplyCandidates', () => {
  test('ranks candidates by score descending', () => {
    const demand = createDemand({ cropId: 'bok-choy', quantity: 100 });
    const candidates = [
      createSupply({
        plantingRecordId: 'pr_1',
        availableQuantity: 50,
      }),
      createSupply({
        plantingRecordId: 'pr_2',
        availableQuantity: 150,
      }),
      createSupply({
        plantingRecordId: 'pr_3',
        availableQuantity: 100,
      }),
    ];

    const ranked = rankSupplyCandidates(candidates, demand);

    // Higher quantity should score higher (for this demand)
    expect(ranked[0]!.plantingRecordId).toBe('pr_2');
  });

  test('filters out candidates below minimum score', () => {
    const demand = createDemand({ cropId: 'bok-choy' });
    const candidates = [
      createSupply({ cropId: 'bok-choy' }),
      createSupply({ cropId: 'tomato' }), // Will have 0 score
    ];

    const ranked = rankSupplyCandidates(candidates, demand, { minScore: 30 });

    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.cropId).toBe('bok-choy');
  });

  test('limits results to maxResults', () => {
    const demand = createDemand({ cropId: 'bok-choy' });
    const candidates = Array.from({ length: 20 }, (_, i) =>
      createSupply({ plantingRecordId: `pr_${i}` })
    );

    const ranked = rankSupplyCandidates(candidates, demand, { maxResults: 5 });

    expect(ranked).toHaveLength(5);
  });

  test('returns empty array when no matches', () => {
    const demand = createDemand({ cropId: 'bok-choy' });
    const candidates = [createSupply({ cropId: 'tomato' }), createSupply({ cropId: 'cabbage' })];

    const ranked = rankSupplyCandidates(candidates, demand);

    expect(ranked).toHaveLength(0);
  });
});

describe('canFullyMatch', () => {
  test('returns true when total supply covers demand', () => {
    const candidates = [
      { ...createSupply({ availableQuantity: 60 }), score: createMockScore(80) },
      { ...createSupply({ availableQuantity: 50 }), score: createMockScore(70) },
    ];

    const result = canFullyMatch(candidates, 100);

    expect(result).toBe(true);
  });

  test('returns false when total supply is insufficient', () => {
    const candidates = [
      { ...createSupply({ availableQuantity: 30 }), score: createMockScore(80) },
      { ...createSupply({ availableQuantity: 30 }), score: createMockScore(70) },
    ];

    const result = canFullyMatch(candidates, 100);

    expect(result).toBe(false);
  });

  test('returns true for empty candidates with zero demand', () => {
    const result = canFullyMatch([], 0);

    expect(result).toBe(true);
  });
});

describe('selectOptimalSupply', () => {
  test('selects from highest scored first', () => {
    const candidates = [
      {
        ...createSupply({ plantingRecordId: 'pr_1', availableQuantity: 50 }),
        score: createMockScore(90),
      },
      {
        ...createSupply({ plantingRecordId: 'pr_2', availableQuantity: 50 }),
        score: createMockScore(80),
      },
      {
        ...createSupply({ plantingRecordId: 'pr_3', availableQuantity: 50 }),
        score: createMockScore(70),
      },
    ];

    const selected = selectOptimalSupply(candidates, 80);

    expect(selected).toHaveLength(2);
    expect(selected[0]!.plantingRecordId).toBe('pr_1');
    expect(selected[0]!.allocatedQuantity).toBe(50);
    expect(selected[1]!.plantingRecordId).toBe('pr_2');
    expect(selected[1]!.allocatedQuantity).toBe(30);
  });

  test('allocates partial quantity from last candidate', () => {
    const candidates = [
      { ...createSupply({ availableQuantity: 100 }), score: createMockScore(90) },
    ];

    const selected = selectOptimalSupply(candidates, 60);

    expect(selected).toHaveLength(1);
    expect(selected[0]!.allocatedQuantity).toBe(60);
  });

  test('returns empty array for zero target', () => {
    const candidates = [
      { ...createSupply({ availableQuantity: 100 }), score: createMockScore(90) },
    ];

    const selected = selectOptimalSupply(candidates, 0);

    expect(selected).toHaveLength(0);
  });

  test('handles insufficient supply gracefully', () => {
    const candidates = [{ ...createSupply({ availableQuantity: 30 }), score: createMockScore(90) }];

    const selected = selectOptimalSupply(candidates, 100);

    expect(selected).toHaveLength(1);
    expect(selected[0]!.allocatedQuantity).toBe(30);
  });
});
