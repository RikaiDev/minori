/**
 * Field Schema
 *
 * Fields represent cultivation areas owned by farmers.
 * Each farmer can have multiple fields.
 */

import { pgTable, text, timestamp, varchar, real, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { createId } from '../utils';

/**
 * Fields table - farmer's cultivation areas.
 */
export const fields = pgTable(
  'fields',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to user (farmer) */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Display name of the field */
    name: varchar('name', { length: 100 }),

    /** Total area size in plots (分地) */
    areaSize: real('area_size'),

    /** Location latitude */
    locationLat: real('location_lat'),

    /** Location longitude */
    locationLng: real('location_lng'),

    /** Township/district name */
    township: varchar('township', { length: 50 }),

    /** Notes about the field */
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
    index('fields_user_id_idx').on(table.userId),
    index('fields_township_idx').on(table.township),
  ]
);

export type Field = typeof fields.$inferSelect;
export type NewField = typeof fields.$inferInsert;
