/**
 * User Schema
 *
 * Users include farmers, cooperative administrators, and customers.
 * Each user belongs to a cooperative and is linked via LINE user ID.
 */

import { pgTable, text, timestamp, varchar, index, pgEnum } from 'drizzle-orm/pg-core';
import { cooperatives } from './cooperatives';
import { createId } from '../utils';

/**
 * User role enum.
 * - farmer: Agricultural producers
 * - cooperative_admin: Cooperative administrators with full access
 * - cooperative_staff: Regular cooperative staff with limited access
 * - customer: External buyers
 */
export const userRoleEnum = pgEnum('user_role', [
  'farmer',
  'cooperative_admin',
  'cooperative_staff',
  'customer',
]);

/**
 * Locale enum for internationalization.
 */
export const localeEnum = pgEnum('locale', ['zh-TW', 'en']);

/**
 * Users table - farmers, cooperative admins, and customers.
 */
export const users = pgTable(
  'users',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** LINE user ID for authentication */
    lineUserId: varchar('line_user_id', { length: 50 }).notNull().unique(),

    /** Foreign key to cooperative */
    cooperativeId: text('cooperative_id')
      .notNull()
      .references(() => cooperatives.id, { onDelete: 'cascade' }),

    /** User role */
    role: userRoleEnum('role').notNull().default('farmer'),

    /** Display name */
    name: varchar('name', { length: 100 }),

    /** Phone number */
    phone: varchar('phone', { length: 20 }),

    /** Preferred locale */
    locale: localeEnum('locale').default('zh-TW'),

    /** LINE profile picture URL */
    avatarUrl: text('avatar_url'),

    /** Whether user is active */
    isActive: timestamp('is_active', { withTimezone: true }),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('users_line_user_id_idx').on(table.lineUserId),
    index('users_cooperative_id_idx').on(table.cooperativeId),
    index('users_role_idx').on(table.role),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
