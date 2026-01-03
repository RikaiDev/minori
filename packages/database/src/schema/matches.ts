/**
 * Supply-Demand Matches Schema
 *
 * Stores matches between farmer supply and buyer demand.
 * Tracks the matching, acceptance, and fulfillment process.
 */

import {
  pgTable,
  text,
  timestamp,
  index,
  pgEnum,
  numeric,
  varchar,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';
import { demands, qualityGradeEnumDemand } from './demands';
import { plantingRecords } from './planting-records';
import { users } from './users';
import { cooperatives } from './cooperatives';
import { createId } from '../utils';

/**
 * Match status enum.
 */
export const matchStatusEnum = pgEnum('match_status', [
  'suggested',
  'pending',
  'accepted',
  'rejected',
  'fulfilled',
  'cancelled',
]);

/**
 * Match score structure (stored as JSONB).
 */
export interface MatchScoreData {
  overall: number;
  cropMatch: number;
  quantityMatch: number;
  dateMatch: number;
  priceMatch?: number;
  qualityMatch?: number;
  regionMatch?: number;
}

/**
 * Farmer response structure (stored as JSONB).
 */
export interface FarmerResponseData {
  accepted: boolean;
  respondedAt: string; // ISO date string
  notes?: string;
}

/**
 * Buyer confirmation structure (stored as JSONB).
 */
export interface BuyerConfirmationData {
  confirmed: boolean;
  confirmedAt: string; // ISO date string
  notes?: string;
}

/**
 * Supply-demand matches table.
 */
export const matches = pgTable(
  'matches',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Demand request ID (foreign key) */
    demandId: text('demand_id')
      .notNull()
      .references(() => demands.id, { onDelete: 'cascade' }),

    /** Supply source - planting record ID (foreign key) */
    plantingRecordId: text('planting_record_id')
      .notNull()
      .references(() => plantingRecords.id, { onDelete: 'cascade' }),

    /** Farmer user ID (foreign key) */
    farmerId: text('farmer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Farmer name (denormalized for display) */
    farmerName: varchar('farmer_name', { length: 100 }),

    /** Cooperative ID (foreign key) */
    cooperativeId: text('cooperative_id')
      .notNull()
      .references(() => cooperatives.id, { onDelete: 'cascade' }),

    /** Crop ID (denormalized for queries) */
    cropId: varchar('crop_id', { length: 50 }).notNull(),

    /** Crop name (denormalized for display) */
    cropName: varchar('crop_name', { length: 100 }).notNull(),

    /** Matched quantity in kg */
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),

    /** Expected harvest date */
    expectedHarvestDate: timestamp('expected_harvest_date', {
      withTimezone: true,
    }).notNull(),

    /** Proposed price per kg */
    proposedPricePerKg: numeric('proposed_price_per_kg', {
      precision: 10,
      scale: 2,
    }),

    /** Expected quality grade */
    expectedQualityGrade: qualityGradeEnumDemand('expected_quality_grade'),

    /** Match score breakdown (JSONB) */
    score: jsonb('score').$type<MatchScoreData>().notNull(),

    /** Current match status */
    status: matchStatusEnum('status').notNull().default('suggested'),

    /** Farmer's response (JSONB) */
    farmerResponse: jsonb('farmer_response').$type<FarmerResponseData>(),

    /** Buyer's confirmation (JSONB) */
    buyerConfirmation: jsonb('buyer_confirmation').$type<BuyerConfirmationData>(),

    /** Whether farmer has been notified */
    farmerNotified: boolean('farmer_notified').notNull().default(false),

    /** When farmer was notified */
    farmerNotifiedAt: timestamp('farmer_notified_at', { withTimezone: true }),

    /** Whether buyer has been notified of acceptance */
    buyerNotified: boolean('buyer_notified').notNull().default(false),

    /** When buyer was notified */
    buyerNotifiedAt: timestamp('buyer_notified_at', { withTimezone: true }),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('matches_demand_id_idx').on(table.demandId),
    index('matches_planting_record_id_idx').on(table.plantingRecordId),
    index('matches_farmer_id_idx').on(table.farmerId),
    index('matches_cooperative_id_idx').on(table.cooperativeId),
    index('matches_crop_id_idx').on(table.cropId),
    index('matches_status_idx').on(table.status),
    index('matches_expected_harvest_date_idx').on(table.expectedHarvestDate),
    index('matches_farmer_notified_idx').on(table.farmerNotified),
  ]
);

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
