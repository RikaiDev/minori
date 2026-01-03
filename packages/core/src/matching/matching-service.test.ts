/**
 * Tests for matching service.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { MatchingService, createMatchingService } from './matching-service';

// Create a chainable mock database that properly handles Drizzle's query builder pattern
function createMockDatabase() {
  // Result storage for sequential calls
  let selectResults: unknown[][] = [];
  let insertResults: unknown[][] = [];
  let updateResults: unknown[][] = [];
  let selectCallIndex = 0;
  let insertCallIndex = 0;
  let updateCallIndex = 0;

  // Create a thenable chain that can be awaited or chained further
  const createChain = (): unknown => {
    const getNextSelectResult = () => {
      const results = selectResults[selectCallIndex] ?? [];
      selectCallIndex++;
      return results;
    };

    const getNextInsertResult = () => {
      const results = insertResults[insertCallIndex] ?? [];
      insertCallIndex++;
      return results;
    };

    // Make the chain thenable so it can be awaited at any point
    const chain: Record<string, unknown> = {
      select: () => createChain(),
      from: () => createChain(),
      where: () => createChain(),
      orderBy: () => createChain(),
      limit: () => Promise.resolve(getNextSelectResult()),
      insert: () => createChain(),
      values: () => createChain(),
      returning: () => Promise.resolve(getNextInsertResult()),
      update: () => createChain(),
      set: () => createChain(),
      innerJoin: () => createChain(),
      // Make the chain thenable - this allows `await db.select().from().where().orderBy()`
      then: (resolve: (value: unknown[]) => void, reject: (error: unknown) => void) => {
        try {
          resolve(getNextSelectResult());
        } catch (e) {
          reject(e);
        }
      },
    };
    return chain;
  };

  // Special chain for update that returns from updateResults
  const createUpdateChain = (): unknown => {
    const getNextUpdateResult = () => {
      const results = updateResults[updateCallIndex] ?? [];
      updateCallIndex++;
      return results;
    };

    const chain: Record<string, unknown> = {
      set: () => chain,
      where: () => chain,
      returning: () => Promise.resolve(getNextUpdateResult()),
      then: (resolve: (value: unknown[]) => void, reject: (error: unknown) => void) => {
        try {
          resolve(getNextUpdateResult());
        } catch (e) {
          reject(e);
        }
      },
    };
    return chain;
  };

  // Special chain for insert that returns from insertResults
  const createInsertChain = (): unknown => {
    const getNextInsertResult = () => {
      const results = insertResults[insertCallIndex] ?? [];
      insertCallIndex++;
      return results;
    };

    const chain: Record<string, unknown> = {
      values: () => chain,
      returning: () => Promise.resolve(getNextInsertResult()),
      then: (resolve: (value: unknown[]) => void, reject: (error: unknown) => void) => {
        try {
          resolve(getNextInsertResult());
        } catch (e) {
          reject(e);
        }
      },
    };
    return chain;
  };

  const db = {
    select: () => createChain(),
    insert: () => createInsertChain(),
    update: () => createUpdateChain(),
    // Test helpers
    _setSelectResults: (results: unknown[][]) => {
      selectResults = results;
      selectCallIndex = 0;
    },
    _setInsertResults: (results: unknown[][]) => {
      insertResults = results;
      insertCallIndex = 0;
    },
    _setUpdateResults: (results: unknown[][]) => {
      updateResults = results;
      updateCallIndex = 0;
    },
    _reset: () => {
      selectResults = [];
      insertResults = [];
      updateResults = [];
      selectCallIndex = 0;
      insertCallIndex = 0;
      updateCallIndex = 0;
    },
  };

  return db;
}

const mockDb = createMockDatabase();

// Helper to create a demand database record
function createDemandRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: 'demand-1',
    buyerId: 'buyer-1',
    buyerName: '買家一',
    cooperativeId: 'coop-1',
    cropId: 'bok-choy',
    cropName: '小白菜',
    quantity: '100',
    matchedQuantity: '0',
    minQualityGrade: 'B',
    deliveryDateStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
    deliveryDateEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    maxPricePerKg: '40',
    preferredRegion: 'central',
    priority: 'medium',
    status: 'pending',
    notes: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('MatchingService', () => {
  let service: MatchingService;
  const cooperativeId = 'coop-1';

  beforeEach(() => {
    mockDb._reset();
    service = new MatchingService(
      cooperativeId,
      undefined,
      mockDb as unknown as ConstructorParameters<typeof MatchingService>[2]
    );
  });

  describe('createDemand', () => {
    test('creates a new demand', async () => {
      const demandRecord = createDemandRecord();
      mockDb._setInsertResults([[demandRecord]]);

      const result = await service.createDemand({
        buyerId: 'buyer-1',
        buyerName: '買家一',
        cropId: 'bok-choy',
        cropName: '小白菜',
        quantity: 100,
        deliveryDateStart: demandRecord.deliveryDateStart,
        deliveryDateEnd: demandRecord.deliveryDateEnd,
        priority: 'medium',
      });

      expect(result.id).toBe('demand-1');
      expect(result.cropId).toBe('bok-choy');
      expect(result.quantity).toBe(100);
      expect(result.status).toBe('pending');
    });

    test('throws error when insert fails', async () => {
      mockDb._setInsertResults([[]]);

      await expect(
        service.createDemand({
          buyerId: 'buyer-1',
          cropId: 'bok-choy',
          cropName: '小白菜',
          quantity: 100,
          deliveryDateStart: new Date(),
          deliveryDateEnd: new Date(),
          priority: 'medium',
        })
      ).rejects.toThrow('Failed to create demand');
    });
  });

  describe('getPendingDemands', () => {
    test('returns pending demands for cooperative', async () => {
      const demandRecord = createDemandRecord({ status: 'pending' });
      mockDb._setSelectResults([[demandRecord]]);

      const result = await service.getPendingDemands();

      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('pending');
    });

    test('returns empty array when no pending demands', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.getPendingDemands();

      expect(result).toHaveLength(0);
    });

    test('includes partially matched demands', async () => {
      const demands = [
        createDemandRecord({ status: 'pending' }),
        createDemandRecord({ id: 'demand-2', status: 'partially_matched', matchedQuantity: '50' }),
      ];
      mockDb._setSelectResults([demands]);

      const result = await service.getPendingDemands();

      expect(result).toHaveLength(2);
    });
  });

  describe('getAllDemands', () => {
    test('returns all demands for cooperative', async () => {
      const demands = [
        createDemandRecord({ status: 'pending' }),
        createDemandRecord({ id: 'demand-2', status: 'matched' }),
        createDemandRecord({ id: 'demand-3', status: 'cancelled' }),
      ];
      mockDb._setSelectResults([demands]);

      const result = await service.getAllDemands();

      expect(result).toHaveLength(3);
    });
  });

  describe('getDemandById', () => {
    test('returns demand when found', async () => {
      const demandRecord = createDemandRecord();
      mockDb._setSelectResults([[demandRecord]]);

      const result = await service.getDemandById('demand-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('demand-1');
    });

    test('returns null when demand not found', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.getDemandById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateDemandStatus', () => {
    test('updates demand status', async () => {
      const updatedRecord = createDemandRecord({ status: 'matched', matchedQuantity: '100' });
      mockDb._setUpdateResults([[updatedRecord]]);

      const result = await service.updateDemandStatus('demand-1', 'matched', 100);

      expect(result).not.toBeNull();
      expect(result?.status).toBe('matched');
      expect(result?.matchedQuantity).toBe(100);
    });

    test('returns null when demand not found', async () => {
      mockDb._setUpdateResults([[]]);

      const result = await service.updateDemandStatus('nonexistent', 'cancelled');

      expect(result).toBeNull();
    });
  });

  describe('cancelDemand', () => {
    test('cancels demand successfully', async () => {
      const cancelledRecord = createDemandRecord({ status: 'cancelled' });
      mockDb._setUpdateResults([[cancelledRecord]]);

      const result = await service.cancelDemand('demand-1');

      expect(result).toBe(true);
    });

    test('returns false when demand not found', async () => {
      mockDb._setUpdateResults([[]]);

      const result = await service.cancelDemand('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getAvailableSupply', () => {
    test('returns available supply candidates', async () => {
      const now = new Date();
      const supplyRecords = [
        {
          plantingRecordId: 'pr-1',
          farmerId: 'farmer-1',
          farmerName: '王大明',
          cropId: 'bok-choy',
          cropName: '小白菜',
          expectedYield: 100,
          expectedHarvestDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          predictionConfidence: 0.85,
          region: 'central',
        },
      ];
      mockDb._setSelectResults([supplyRecords]);

      const result = await service.getAvailableSupply();

      expect(result).toHaveLength(1);
      expect(result[0]?.cropId).toBe('bok-choy');
      expect(result[0]?.availableQuantity).toBe(100);
    });

    test('filters out records with no yield', async () => {
      const now = new Date();
      const supplyRecords = [
        {
          plantingRecordId: 'pr-1',
          farmerId: 'farmer-1',
          farmerName: '王大明',
          cropId: 'bok-choy',
          cropName: '小白菜',
          expectedYield: null,
          expectedHarvestDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          predictionConfidence: 0.85,
          region: 'central',
        },
        {
          plantingRecordId: 'pr-2',
          farmerId: 'farmer-2',
          farmerName: '李小華',
          cropId: 'bok-choy',
          cropName: '小白菜',
          expectedYield: 0,
          expectedHarvestDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          predictionConfidence: 0.85,
          region: 'central',
        },
      ];
      mockDb._setSelectResults([supplyRecords]);

      const result = await service.getAvailableSupply();

      expect(result).toHaveLength(0);
    });

    test('returns empty array when no supply available', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.getAvailableSupply();

      expect(result).toHaveLength(0);
    });
  });

  describe('getSupplyForCrop', () => {
    test('filters supply by crop ID', async () => {
      const now = new Date();
      const supplyRecords = [
        {
          plantingRecordId: 'pr-1',
          farmerId: 'farmer-1',
          farmerName: '王大明',
          cropId: 'bok-choy',
          cropName: '小白菜',
          expectedYield: 100,
          expectedHarvestDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          predictionConfidence: 0.85,
          region: 'central',
        },
        {
          plantingRecordId: 'pr-2',
          farmerId: 'farmer-2',
          farmerName: '李小華',
          cropId: 'tomato',
          cropName: '番茄',
          expectedYield: 50,
          expectedHarvestDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          predictionConfidence: 0.8,
          region: 'north',
        },
      ];
      mockDb._setSelectResults([supplyRecords]);

      const result = await service.getSupplyForCrop('bok-choy');

      expect(result).toHaveLength(1);
      expect(result[0]?.cropId).toBe('bok-choy');
    });
  });

  describe('findMatchesForDemand', () => {
    test('returns null when demand not found', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.findMatchesForDemand('nonexistent');

      expect(result).toBeNull();
    });

    test('returns match suggestion for valid demand', async () => {
      const now = new Date();
      const demandRecord = createDemandRecord({
        deliveryDateStart: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        deliveryDateEnd: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      });
      const supplyRecords = [
        {
          plantingRecordId: 'pr-1',
          farmerId: 'farmer-1',
          farmerName: '王大明',
          cropId: 'bok-choy',
          cropName: '小白菜',
          expectedYield: 150,
          expectedHarvestDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          predictionConfidence: 0.85,
          region: 'central',
        },
      ];

      // getDemandById, then getAvailableSupply
      mockDb._setSelectResults([[demandRecord], supplyRecords]);

      const result = await service.findMatchesForDemand('demand-1');

      expect(result).not.toBeNull();
      expect(result?.demand.id).toBe('demand-1');
      expect(result?.matches.length).toBeGreaterThan(0);
    });

    test('returns empty matches when no supply available', async () => {
      const demandRecord = createDemandRecord();
      mockDb._setSelectResults([[demandRecord], []]);

      const result = await service.findMatchesForDemand('demand-1');

      expect(result).not.toBeNull();
      expect(result?.matches).toHaveLength(0);
      expect(result?.canFullyMatch).toBe(false);
    });
  });

  describe('getMatchingSummary', () => {
    test('calculates summary statistics', async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const periodEnd = now;

      const demands = [
        createDemandRecord({ status: 'pending', matchedQuantity: '0' }),
        createDemandRecord({ id: 'demand-2', status: 'matched', matchedQuantity: '100' }),
        createDemandRecord({ id: 'demand-3', status: 'fulfilled', matchedQuantity: '50' }),
        createDemandRecord({ id: 'demand-4', status: 'cancelled', matchedQuantity: '0' }),
      ];
      mockDb._setSelectResults([demands]);

      const result = await service.getMatchingSummary(periodStart, periodEnd);

      expect(result.totalDemands).toBe(4);
      expect(result.pendingDemands).toBe(1);
      expect(result.matchedDemands).toBe(2); // matched + fulfilled
      expect(result.fulfilledDemands).toBe(1);
      expect(result.totalQuantityMatched).toBe(150); // 100 + 50
    });

    test('returns zero stats for empty period', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.getMatchingSummary(new Date(), new Date());

      expect(result.totalDemands).toBe(0);
      expect(result.pendingDemands).toBe(0);
      expect(result.matchedDemands).toBe(0);
      expect(result.successRate).toBe(0);
    });

    test('calculates top crops correctly', async () => {
      const demands = [
        createDemandRecord({ cropId: 'bok-choy', cropName: '小白菜', matchedQuantity: '100' }),
        createDemandRecord({
          id: 'd2',
          cropId: 'bok-choy',
          cropName: '小白菜',
          matchedQuantity: '50',
        }),
        createDemandRecord({ id: 'd3', cropId: 'tomato', cropName: '番茄', matchedQuantity: '30' }),
      ];
      mockDb._setSelectResults([demands]);

      const result = await service.getMatchingSummary(new Date(), new Date());

      expect(result.topCrops).toHaveLength(2);
      expect(result.topCrops[0]?.cropId).toBe('bok-choy');
      expect(result.topCrops[0]?.matchCount).toBe(2);
      expect(result.topCrops[0]?.totalQuantity).toBe(150);
    });
  });
});

describe('createMatchingService', () => {
  test('creates service instance with provided database', () => {
    const service = createMatchingService(
      'coop-1',
      undefined,
      mockDb as unknown as ConstructorParameters<typeof MatchingService>[2]
    );

    expect(service).toBeInstanceOf(MatchingService);
  });

  test('applies custom config', () => {
    const service = createMatchingService(
      'coop-1',
      {
        minMatchScore: 50,
        maxSuggestionsPerDemand: 5,
      },
      mockDb as unknown as ConstructorParameters<typeof MatchingService>[2]
    );

    expect(service).toBeInstanceOf(MatchingService);
  });
});
