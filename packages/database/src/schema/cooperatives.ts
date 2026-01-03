/**
 * Cooperative Schema
 *
 * Cooperatives are the multi-tenant root entity.
 * Each cooperative has multiple farmers who share data.
 */

import { pgTable, text, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { createId } from '../utils';

/**
 * Cooperatives table - multi-tenant root entity.
 */
export const cooperatives = pgTable(
  'cooperatives',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Display name of the cooperative */
    name: varchar('name', { length: 100 }).notNull(),

    /** Unique code for the cooperative (e.g., "tainan-001") */
    code: varchar('code', { length: 50 }).notNull().unique(),

    /** Taiwan region (north, central, south, east) */
    region: varchar('region', { length: 20 }),

    /** Contact email */
    email: varchar('email', { length: 255 }),

    /** Contact phone */
    phone: varchar('phone', { length: 20 }),

    /** Address */
    address: text('address'),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('cooperatives_code_idx').on(table.code),
    index('cooperatives_region_idx').on(table.region),
  ]
);

export type Cooperative = typeof cooperatives.$inferSelect;
export type NewCooperative = typeof cooperatives.$inferInsert;
