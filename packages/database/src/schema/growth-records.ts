/**
 * Growth Record Schema
 *
 * Records growth status updates for planted crops.
 * Used for tracking crop health and updating predictions.
 */

import { pgTable, text, timestamp, index, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { plantingRecords } from './planting-records';
import { createId } from '../utils';

/**
 * Growth condition enum.
 */
export const growthConditionEnum = pgEnum('growth_condition', [
  'excellent',
  'good',
  'normal',
  'poor',
  'critical',
]);

/**
 * Growth records table - records of crop growth status updates.
 */
export const growthRecords = pgTable(
  'growth_records',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to planting record */
    plantingRecordId: text('planting_record_id')
      .notNull()
      .references(() => plantingRecords.id, { onDelete: 'cascade' }),

    /** Growth condition */
    condition: growthConditionEnum('condition').notNull(),

    /** Notes about the growth status */
    notes: text('notes'),

    /** Image URLs (stored as JSON array) */
    images: jsonb('images').$type<string[]>(),

    /** Date when the status was recorded */
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('growth_records_planting_record_id_idx').on(table.plantingRecordId),
    index('growth_records_recorded_at_idx').on(table.recordedAt),
    index('growth_records_condition_idx').on(table.condition),
  ]
);

export type GrowthRecord = typeof growthRecords.$inferSelect;
export type NewGrowthRecord = typeof growthRecords.$inferInsert;
