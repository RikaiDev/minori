/**
 * Planting Record Schema
 *
 * Records when a farmer plants a crop on a field.
 * Tracks expected harvest dates and status.
 */

import { pgTable, text, timestamp, varchar, real, index, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { fields } from './fields';
import { createId } from '../utils';

/**
 * Planting status enum.
 */
export const plantingStatusEnum = pgEnum('planting_status', [
  'active',
  'harvested',
  'cancelled',
  'failed',
]);

/**
 * Planting records table - records of crop planting events.
 */
export const plantingRecords = pgTable(
  'planting_records',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to user (farmer) */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Foreign key to field (optional - may not have a specific field) */
    fieldId: text('field_id').references(() => fields.id, { onDelete: 'set null' }),

    /** Crop ID (references crop database in @minori/core) */
    cropId: varchar('crop_id', { length: 50 }).notNull(),

    /** Crop name (denormalized for quick access) */
    cropName: varchar('crop_name', { length: 100 }).notNull(),

    /** Area planted in plots (分地) */
    areaSize: real('area_size').notNull(),

    /** Date when crop was planted */
    plantedAt: timestamp('planted_at', { withTimezone: true }).notNull(),

    /** Expected harvest date (AI-predicted) */
    expectedHarvestDate: timestamp('expected_harvest_date', { withTimezone: true }),

    /** Expected yield in kg (AI-predicted) */
    expectedYield: real('expected_yield'),

    /** Prediction confidence (0-1) */
    predictionConfidence: real('prediction_confidence'),

    /** Current status */
    status: plantingStatusEnum('status').notNull().default('active'),

    /** Notes about the planting */
    notes: text('notes'),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('planting_records_user_id_idx').on(table.userId),
    index('planting_records_field_id_idx').on(table.fieldId),
    index('planting_records_crop_id_idx').on(table.cropId),
    index('planting_records_status_idx').on(table.status),
    index('planting_records_planted_at_idx').on(table.plantedAt),
    index('planting_records_expected_harvest_idx').on(table.expectedHarvestDate),
    // Composite index for cooperative aggregation queries
    index('planting_records_user_status_idx').on(table.userId, table.status),
  ]
);

export type PlantingRecord = typeof plantingRecords.$inferSelect;
export type NewPlantingRecord = typeof plantingRecords.$inferInsert;
