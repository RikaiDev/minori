/**
 * Demand Requests Schema
 *
 * Stores buyer demand requests for agricultural products.
 * Used for supply-demand matching system.
 */

import { pgTable, text, timestamp, index, pgEnum, numeric, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cooperatives } from './cooperatives';
import { createId } from '../utils';

/**
 * Demand status enum.
 */
export const demandStatusEnum = pgEnum('demand_status', [
  'pending',
  'partially_matched',
  'matched',
  'fulfilled',
  'expired',
  'cancelled',
]);

/**
 * Demand priority enum.
 */
export const demandPriorityEnum = pgEnum('demand_priority', ['low', 'medium', 'high', 'urgent']);

/**
 * Quality grade enum (reused from harvest records concept).
 */
export const qualityGradeEnumDemand = pgEnum('quality_grade_demand', ['A', 'B', 'C', 'D']);

/**
 * Taiwan region enum for demand preferences.
 */
export const taiwanRegionEnum = pgEnum('taiwan_region', ['north', 'central', 'south', 'east']);

/**
 * Demand requests table - buyer requests for agricultural products.
 */
export const demands = pgTable(
  'demands',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Buyer user ID (foreign key) */
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Buyer name (denormalized for display) */
    buyerName: varchar('buyer_name', { length: 100 }),

    /** Cooperative ID (optional, for cooperative network buyers) */
    cooperativeId: text('cooperative_id').references(() => cooperatives.id, {
      onDelete: 'set null',
    }),

    /** Requested crop ID (from @minori/core crop database) */
    cropId: varchar('crop_id', { length: 50 }).notNull(),

    /** Crop name (denormalized for display) */
    cropName: varchar('crop_name', { length: 100 }).notNull(),

    /** Quantity needed in kg */
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),

    /** Quantity already matched in kg */
    matchedQuantity: numeric('matched_quantity', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),

    /** Minimum acceptable quality grade */
    minQualityGrade: qualityGradeEnumDemand('min_quality_grade'),

    /** Desired delivery date (earliest) */
    deliveryDateStart: timestamp('delivery_date_start', {
      withTimezone: true,
    }).notNull(),

    /** Desired delivery date (latest) */
    deliveryDateEnd: timestamp('delivery_date_end', {
      withTimezone: true,
    }).notNull(),

    /** Maximum price willing to pay (per kg) */
    maxPricePerKg: numeric('max_price_per_kg', { precision: 10, scale: 2 }),

    /** Preferred region for sourcing */
    preferredRegion: taiwanRegionEnum('preferred_region'),

    /** Priority level */
    priority: demandPriorityEnum('priority').notNull().default('medium'),

    /** Current status */
    status: demandStatusEnum('status').notNull().default('pending'),

    /** Additional notes */
    notes: text('notes'),

    /** Expiration date for this demand */
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('demands_buyer_id_idx').on(table.buyerId),
    index('demands_cooperative_id_idx').on(table.cooperativeId),
    index('demands_crop_id_idx').on(table.cropId),
    index('demands_status_idx').on(table.status),
    index('demands_priority_idx').on(table.priority),
    index('demands_delivery_date_idx').on(table.deliveryDateStart, table.deliveryDateEnd),
    index('demands_expires_at_idx').on(table.expiresAt),
  ]
);

export type Demand = typeof demands.$inferSelect;
export type NewDemand = typeof demands.$inferInsert;
