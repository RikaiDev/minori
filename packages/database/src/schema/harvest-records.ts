/**
 * Harvest Record Schema
 *
 * Records when a farmer harvests a crop.
 * Links to the original planting record.
 */

import { pgTable, text, timestamp, varchar, real, index, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { plantingRecords } from './planting-records';
import { createId } from '../utils';

/**
 * Quality grade enum.
 */
export const qualityGradeEnum = pgEnum('quality_grade', ['A', 'B', 'C', 'D']);

/**
 * Harvest records table - records of crop harvest events.
 */
export const harvestRecords = pgTable(
  'harvest_records',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to planting record */
    plantingRecordId: text('planting_record_id')
      .notNull()
      .references(() => plantingRecords.id, { onDelete: 'cascade' }),

    /** Foreign key to user (farmer) - denormalized for query efficiency */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Crop ID (denormalized for query efficiency) */
    cropId: varchar('crop_id', { length: 50 }).notNull(),

    /** Crop name (denormalized for quick access) */
    cropName: varchar('crop_name', { length: 100 }).notNull(),

    /** Quantity harvested in kg */
    quantity: real('quantity').notNull(),

    /** Quality grade */
    qualityGrade: qualityGradeEnum('quality_grade'),

    /** Date when crop was harvested */
    harvestedAt: timestamp('harvested_at', { withTimezone: true }).notNull(),

    /** Market price at harvest time (per kg) */
    marketPrice: real('market_price'),

    /** Whether cooperative has been notified */
    cooperativeNotified: timestamp('cooperative_notified', { withTimezone: true }),

    /** Notes about the harvest */
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
    index('harvest_records_planting_record_id_idx').on(table.plantingRecordId),
    index('harvest_records_user_id_idx').on(table.userId),
    index('harvest_records_crop_id_idx').on(table.cropId),
    index('harvest_records_harvested_at_idx').on(table.harvestedAt),
    // Composite index for date range queries by user
    index('harvest_records_user_date_idx').on(table.userId, table.harvestedAt),
  ]
);

export type HarvestRecord = typeof harvestRecords.$inferSelect;
export type NewHarvestRecord = typeof harvestRecords.$inferInsert;
