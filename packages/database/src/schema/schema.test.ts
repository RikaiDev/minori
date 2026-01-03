/**
 * Unit tests for database schema.
 *
 * Tests schema structure and type definitions.
 * Note: These are unit tests that don't require a database connection.
 */

import { describe, expect, test } from 'bun:test';
import { getTableName } from 'drizzle-orm';
import {
  cooperatives,
  users,
  fields,
  plantingRecords,
  harvestRecords,
  growthRecords,
  demands,
  matches,
  userRoleEnum,
  localeEnum,
  plantingStatusEnum,
  qualityGradeEnum,
  growthConditionEnum,
  demandStatusEnum,
  demandPriorityEnum,
  matchStatusEnum,
  taiwanRegionEnum,
} from './index';

describe('cooperatives table', () => {
  test('has required columns', () => {
    const columns = Object.keys(cooperatives);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('code');
    expect(columns).toContain('region');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  test('table name is correct', () => {
    expect(getTableName(cooperatives)).toBe('cooperatives');
  });
});

describe('users table', () => {
  test('has required columns', () => {
    const columns = Object.keys(users);
    expect(columns).toContain('id');
    expect(columns).toContain('lineUserId');
    expect(columns).toContain('cooperativeId');
    expect(columns).toContain('role');
    expect(columns).toContain('name');
    expect(columns).toContain('locale');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  test('table name is correct', () => {
    expect(getTableName(users)).toBe('users');
  });
});

describe('fields table', () => {
  test('has required columns', () => {
    const columns = Object.keys(fields);
    expect(columns).toContain('id');
    expect(columns).toContain('userId');
    expect(columns).toContain('name');
    expect(columns).toContain('areaSize');
    expect(columns).toContain('locationLat');
    expect(columns).toContain('locationLng');
  });

  test('table name is correct', () => {
    expect(getTableName(fields)).toBe('fields');
  });
});

describe('plantingRecords table', () => {
  test('has required columns', () => {
    const columns = Object.keys(plantingRecords);
    expect(columns).toContain('id');
    expect(columns).toContain('userId');
    expect(columns).toContain('fieldId');
    expect(columns).toContain('cropId');
    expect(columns).toContain('cropName');
    expect(columns).toContain('areaSize');
    expect(columns).toContain('plantedAt');
    expect(columns).toContain('expectedHarvestDate');
    expect(columns).toContain('status');
  });

  test('table name is correct', () => {
    expect(getTableName(plantingRecords)).toBe('planting_records');
  });
});

describe('harvestRecords table', () => {
  test('has required columns', () => {
    const columns = Object.keys(harvestRecords);
    expect(columns).toContain('id');
    expect(columns).toContain('plantingRecordId');
    expect(columns).toContain('userId');
    expect(columns).toContain('cropId');
    expect(columns).toContain('quantity');
    expect(columns).toContain('harvestedAt');
    expect(columns).toContain('qualityGrade');
  });

  test('table name is correct', () => {
    expect(getTableName(harvestRecords)).toBe('harvest_records');
  });
});

describe('growthRecords table', () => {
  test('has required columns', () => {
    const columns = Object.keys(growthRecords);
    expect(columns).toContain('id');
    expect(columns).toContain('plantingRecordId');
    expect(columns).toContain('condition');
    expect(columns).toContain('notes');
    expect(columns).toContain('images');
    expect(columns).toContain('recordedAt');
  });

  test('table name is correct', () => {
    expect(getTableName(growthRecords)).toBe('growth_records');
  });
});

describe('enums', () => {
  test('userRoleEnum has correct values', () => {
    expect(userRoleEnum.enumName).toBe('user_role');
    expect(userRoleEnum.enumValues).toContain('farmer');
    expect(userRoleEnum.enumValues).toContain('cooperative');
    expect(userRoleEnum.enumValues).toContain('customer');
  });

  test('localeEnum has correct values', () => {
    expect(localeEnum.enumName).toBe('locale');
    expect(localeEnum.enumValues).toContain('zh-TW');
    expect(localeEnum.enumValues).toContain('en');
  });

  test('plantingStatusEnum has correct values', () => {
    expect(plantingStatusEnum.enumName).toBe('planting_status');
    expect(plantingStatusEnum.enumValues).toContain('active');
    expect(plantingStatusEnum.enumValues).toContain('harvested');
    expect(plantingStatusEnum.enumValues).toContain('cancelled');
    expect(plantingStatusEnum.enumValues).toContain('failed');
  });

  test('qualityGradeEnum has correct values', () => {
    expect(qualityGradeEnum.enumName).toBe('quality_grade');
    expect(qualityGradeEnum.enumValues).toContain('A');
    expect(qualityGradeEnum.enumValues).toContain('B');
    expect(qualityGradeEnum.enumValues).toContain('C');
    expect(qualityGradeEnum.enumValues).toContain('D');
  });

  test('growthConditionEnum has correct values', () => {
    expect(growthConditionEnum.enumName).toBe('growth_condition');
    expect(growthConditionEnum.enumValues).toContain('excellent');
    expect(growthConditionEnum.enumValues).toContain('good');
    expect(growthConditionEnum.enumValues).toContain('normal');
    expect(growthConditionEnum.enumValues).toContain('poor');
    expect(growthConditionEnum.enumValues).toContain('critical');
  });

  test('demandStatusEnum has correct values', () => {
    expect(demandStatusEnum.enumName).toBe('demand_status');
    expect(demandStatusEnum.enumValues).toContain('pending');
    expect(demandStatusEnum.enumValues).toContain('partially_matched');
    expect(demandStatusEnum.enumValues).toContain('matched');
    expect(demandStatusEnum.enumValues).toContain('fulfilled');
    expect(demandStatusEnum.enumValues).toContain('expired');
    expect(demandStatusEnum.enumValues).toContain('cancelled');
  });

  test('demandPriorityEnum has correct values', () => {
    expect(demandPriorityEnum.enumName).toBe('demand_priority');
    expect(demandPriorityEnum.enumValues).toContain('low');
    expect(demandPriorityEnum.enumValues).toContain('medium');
    expect(demandPriorityEnum.enumValues).toContain('high');
    expect(demandPriorityEnum.enumValues).toContain('urgent');
  });

  test('matchStatusEnum has correct values', () => {
    expect(matchStatusEnum.enumName).toBe('match_status');
    expect(matchStatusEnum.enumValues).toContain('suggested');
    expect(matchStatusEnum.enumValues).toContain('pending');
    expect(matchStatusEnum.enumValues).toContain('accepted');
    expect(matchStatusEnum.enumValues).toContain('rejected');
    expect(matchStatusEnum.enumValues).toContain('fulfilled');
    expect(matchStatusEnum.enumValues).toContain('cancelled');
  });

  test('taiwanRegionEnum has correct values', () => {
    expect(taiwanRegionEnum.enumName).toBe('taiwan_region');
    expect(taiwanRegionEnum.enumValues).toContain('north');
    expect(taiwanRegionEnum.enumValues).toContain('central');
    expect(taiwanRegionEnum.enumValues).toContain('south');
    expect(taiwanRegionEnum.enumValues).toContain('east');
  });
});

describe('demands table', () => {
  test('has required columns', () => {
    const columns = Object.keys(demands);
    expect(columns).toContain('id');
    expect(columns).toContain('buyerId');
    expect(columns).toContain('cropId');
    expect(columns).toContain('cropName');
    expect(columns).toContain('quantity');
    expect(columns).toContain('matchedQuantity');
    expect(columns).toContain('deliveryDateStart');
    expect(columns).toContain('deliveryDateEnd');
    expect(columns).toContain('priority');
    expect(columns).toContain('status');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  test('table name is correct', () => {
    expect(getTableName(demands)).toBe('demands');
  });
});

describe('matches table', () => {
  test('has required columns', () => {
    const columns = Object.keys(matches);
    expect(columns).toContain('id');
    expect(columns).toContain('demandId');
    expect(columns).toContain('plantingRecordId');
    expect(columns).toContain('farmerId');
    expect(columns).toContain('cooperativeId');
    expect(columns).toContain('cropId');
    expect(columns).toContain('cropName');
    expect(columns).toContain('quantity');
    expect(columns).toContain('expectedHarvestDate');
    expect(columns).toContain('score');
    expect(columns).toContain('status');
    expect(columns).toContain('createdAt');
    expect(columns).toContain('updatedAt');
  });

  test('table name is correct', () => {
    expect(getTableName(matches)).toBe('matches');
  });
});
