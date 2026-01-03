/**
 * Unit tests for Field Record Service.
 */

import { describe, expect, test, mock, beforeEach } from 'bun:test';

// Create a chainable mock database that properly handles Drizzle's query builder pattern
function createMockDatabase() {
  // Result storage for sequential calls
  let selectResults: unknown[][] = [];
  let insertResults: unknown[][] = [];
  let selectCallIndex = 0;
  let insertCallIndex = 0;

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

  const db = {
    select: () => createChain(),
    insert: () => createChain(),
    update: () => createChain(),
    // Test helpers
    _setSelectResults: (results: unknown[][]) => {
      selectResults = results;
      selectCallIndex = 0;
    },
    _setInsertResults: (results: unknown[][]) => {
      insertResults = results;
      insertCallIndex = 0;
    },
    _reset: () => {
      selectResults = [];
      insertResults = [];
      selectCallIndex = 0;
      insertCallIndex = 0;
    },
  };

  return db;
}

const mockDb = createMockDatabase();

mock.module('@minori/database', () => ({
  getDatabase: () => mockDb,
  plantingRecords: { id: 'id', userId: 'userId', status: 'status', cropId: 'cropId' },
  harvestRecords: { id: 'id' },
  growthRecords: { id: 'id' },
  users: { id: 'id', lineUserId: 'lineUserId', cooperativeId: 'cooperativeId' },
  fields: { id: 'id', userId: 'userId', name: 'name', areaSize: 'areaSize' },
  eq: (field: string, value: unknown) => ({ field, value, op: 'eq' }),
  and: (...conditions: unknown[]) => ({ conditions, op: 'and' }),
  desc: (field: string) => ({ field, order: 'desc' }),
}));

mock.module('@minori/core', () => ({
  findCropByName: (name: string) => {
    if (name === '小白菜' || name === 'bok-choy') {
      return {
        id: 'bok-choy',
        name: '小白菜',
        yield: { perArea: 50 },
      };
    }
    return null;
  },
  predictHarvest: () => ({
    predictions: {
      earliest: new Date('2025-01-20'),
      likely: new Date('2025-01-25'),
      latest: new Date('2025-01-30'),
    },
    confidence: 0.85,
  }),
}));

import { FieldRecordService } from './field-record-service';

describe('FieldRecordService', () => {
  let service: FieldRecordService;

  beforeEach(() => {
    mockDb._reset();
    // Create service with mock database - cast to match expected type
    service = new FieldRecordService(
      mockDb as unknown as ConstructorParameters<typeof FieldRecordService>[0]
    );
  });

  describe('getUserByLineId', () => {
    test('returns user when found', async () => {
      mockDb._setSelectResults([[{ id: 'user-123', cooperativeId: 'coop-1' }]]);

      const result = await service.getUserByLineId('line-user-1');

      expect(result).toEqual({ id: 'user-123', cooperativeId: 'coop-1' });
    });

    test('returns null when user not found', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.getUserByLineId('unknown-user');

      expect(result).toBeNull();
    });
  });

  describe('createPlantingRecord', () => {
    test('creates record with harvest prediction for known crop', async () => {
      // First select: user lookup
      mockDb._setSelectResults([[{ id: 'user-123', cooperativeId: 'coop-1' }]]);
      // Insert returns record
      mockDb._setInsertResults([[{ id: 'record-123' }]]);

      const result = await service.createPlantingRecord({
        lineUserId: 'line-user-1',
        cropId: 'bok-choy',
        cropName: '小白菜',
        area: 2,
      });

      expect(result.id).toBe('record-123');
      expect(result.expectedHarvestDate).toBeDefined();
      expect(result.confidence).toBe(0.85);
    });

    test('throws error when user not found', async () => {
      mockDb._setSelectResults([[]]);

      await expect(
        service.createPlantingRecord({
          lineUserId: 'unknown-user',
          cropId: 'bok-choy',
          cropName: '小白菜',
          area: 2,
        })
      ).rejects.toThrow('User not found');
    });

    test('creates record without prediction for unknown crop', async () => {
      mockDb._setSelectResults([[{ id: 'user-123', cooperativeId: 'coop-1' }]]);
      mockDb._setInsertResults([[{ id: 'record-456' }]]);

      const result = await service.createPlantingRecord({
        lineUserId: 'line-user-1',
        cropId: 'unknown-crop',
        cropName: '未知作物',
        area: 1,
      });

      expect(result.id).toBe('record-456');
      expect(result.expectedHarvestDate).toBeUndefined();
      expect(result.confidence).toBeUndefined();
    });

    test('throws error when insert fails', async () => {
      mockDb._setSelectResults([[{ id: 'user-123', cooperativeId: 'coop-1' }]]);
      mockDb._setInsertResults([[]]);

      await expect(
        service.createPlantingRecord({
          lineUserId: 'line-user-1',
          cropId: 'bok-choy',
          cropName: '小白菜',
          area: 2,
        })
      ).rejects.toThrow('Failed to create planting record');
    });
  });

  describe('getActivePlantingRecords', () => {
    test('returns empty array when user not found', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.getActivePlantingRecords('unknown-user');

      expect(result).toEqual([]);
    });

    test('returns active records for user', async () => {
      // First: user lookup, Second: records query
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [
          {
            id: 'record-1',
            cropId: 'bok-choy',
            cropName: '小白菜',
            area: 2,
            plantedAt: new Date('2025-01-01'),
            expectedHarvestDate: new Date('2025-01-25'),
            expectedYield: 100,
          },
        ],
      ]);

      const result = await service.getActivePlantingRecords('line-user-1');

      expect(result.length).toBe(1);
      expect(result[0]?.cropName).toBe('小白菜');
    });
  });

  describe('findPlantingRecordByCrop', () => {
    test('returns null when user not found', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.findPlantingRecordByCrop('unknown-user', '小白菜');

      expect(result).toBeNull();
    });

    test('returns null when crop not in database', async () => {
      mockDb._setSelectResults([[{ id: 'user-123', cooperativeId: 'coop-1' }]]);

      const result = await service.findPlantingRecordByCrop('line-user-1', '未知作物');

      expect(result).toBeNull();
    });

    test('returns record when found', async () => {
      // First: user lookup, Second: record lookup
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [
          {
            id: 'record-1',
            cropId: 'bok-choy',
            cropName: '小白菜',
            userId: 'user-123',
          },
        ],
      ]);

      const result = await service.findPlantingRecordByCrop('line-user-1', '小白菜');

      expect(result).toEqual({
        id: 'record-1',
        cropId: 'bok-choy',
        cropName: '小白菜',
        userId: 'user-123',
      });
    });

    test('returns null when no matching record', async () => {
      mockDb._setSelectResults([[{ id: 'user-123', cooperativeId: 'coop-1' }], []]);

      const result = await service.findPlantingRecordByCrop('line-user-1', '小白菜');

      expect(result).toBeNull();
    });
  });

  describe('createHarvestRecord', () => {
    test('throws error when user not found', async () => {
      mockDb._setSelectResults([[]]);

      await expect(
        service.createHarvestRecord({
          lineUserId: 'unknown-user',
          cropName: '小白菜',
          quantity: 50,
        })
      ).rejects.toThrow('User not found');
    });

    test('creates harvest record with matching planting record', async () => {
      // Sequence: user lookup for createHarvestRecord,
      // then user lookup + record lookup for findPlantingRecordByCrop
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [{ id: 'planting-1', cropId: 'bok-choy', cropName: '小白菜', userId: 'user-123' }],
      ]);
      mockDb._setInsertResults([[{ id: 'harvest-123' }]]);

      const result = await service.createHarvestRecord({
        lineUserId: 'line-user-1',
        cropName: '小白菜',
        quantity: 50,
        qualityGrade: 'A',
      });

      expect(result.id).toBe('harvest-123');
      expect(result.plantingRecordId).toBe('planting-1');
    });

    test('creates harvest record without planting record', async () => {
      // User found, but no planting record
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [], // No planting record found
      ]);
      mockDb._setInsertResults([[{ id: 'harvest-456' }]]);

      const result = await service.createHarvestRecord({
        lineUserId: 'line-user-1',
        cropName: '小白菜',
        quantity: 30,
      });

      expect(result.id).toBe('harvest-456');
      expect(result.plantingRecordId).toBeUndefined();
    });

    test('throws error when insert fails', async () => {
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [],
      ]);
      mockDb._setInsertResults([[]]);

      await expect(
        service.createHarvestRecord({
          lineUserId: 'line-user-1',
          cropName: '小白菜',
          quantity: 50,
        })
      ).rejects.toThrow('Failed to create harvest record');
    });
  });

  describe('createGrowthRecord', () => {
    test('returns null when planting record not found', async () => {
      // User found but no planting record
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [], // No planting record
      ]);

      const result = await service.createGrowthRecord({
        lineUserId: 'line-user-1',
        cropName: '小白菜',
        condition: 'good',
      });

      expect(result).toBeNull();
    });

    test('returns null when crop not in database', async () => {
      mockDb._setSelectResults([[{ id: 'user-123', cooperativeId: 'coop-1' }]]);

      const result = await service.createGrowthRecord({
        lineUserId: 'line-user-1',
        cropName: '未知作物',
        condition: 'good',
      });

      expect(result).toBeNull();
    });

    test('creates growth record for existing planting', async () => {
      // User lookup, then planting record lookup
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [{ id: 'planting-1', cropId: 'bok-choy', cropName: '小白菜', userId: 'user-123' }],
      ]);
      mockDb._setInsertResults([[{ id: 'growth-123' }]]);

      const result = await service.createGrowthRecord({
        lineUserId: 'line-user-1',
        cropName: '小白菜',
        condition: 'excellent',
        notes: 'Growing well',
      });

      expect(result).toEqual({
        id: 'growth-123',
        plantingRecordId: 'planting-1',
      });
    });

    test('throws error when insert fails', async () => {
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [{ id: 'planting-1', cropId: 'bok-choy', cropName: '小白菜', userId: 'user-123' }],
      ]);
      mockDb._setInsertResults([[]]);

      await expect(
        service.createGrowthRecord({
          lineUserId: 'line-user-1',
          cropName: '小白菜',
          condition: 'good',
        })
      ).rejects.toThrow('Failed to create growth record');
    });
  });

  describe('getUserFields', () => {
    test('returns empty array when user not found', async () => {
      mockDb._setSelectResults([[]]);

      const result = await service.getUserFields('unknown-user');

      expect(result).toEqual([]);
    });

    test('returns fields for user', async () => {
      mockDb._setSelectResults([
        [{ id: 'user-123', cooperativeId: 'coop-1' }],
        [
          { id: 'field-1', name: '田地一', area: 2.5 },
          { id: 'field-2', name: null, area: null },
        ],
      ]);

      const result = await service.getUserFields('line-user-1');

      expect(result.length).toBe(2);
      expect(result[0]?.name).toBe('田地一');
      expect(result[0]?.area).toBe(2.5);
      expect(result[1]?.name).toBe('Unnamed Field');
      expect(result[1]?.area).toBeUndefined();
    });
  });
});

// Note: getFieldRecordService singleton tests are skipped because
// module mocking affects the singleton behavior in test environments.
// The FieldRecordService class is thoroughly tested above.
