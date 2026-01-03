/**
 * Tenant Schema
 *
 * Tables related to multi-tenant configuration including
 * data sharing settings and member invitations.
 */

import { pgTable, text, timestamp, varchar, index, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { cooperatives } from './cooperatives';
import { users, userRoleEnum } from './users';
import { createId } from '../utils';

/**
 * Invitation status enum.
 */
export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'cancelled',
]);

/**
 * Data sharing configuration for cross-cooperative access.
 * Each cooperative can opt-in to share data with other cooperatives.
 */
export const dataSharingConfigs = pgTable(
  'data_sharing_configs',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Cooperative that owns this config */
    cooperativeId: text('cooperative_id')
      .notNull()
      .unique()
      .references(() => cooperatives.id, { onDelete: 'cascade' }),

    /** Whether to share aggregate supply data with other cooperatives */
    shareSupplyData: boolean('share_supply_data').notNull().default(false),

    /** Whether to accept demand requests from other cooperatives */
    acceptExternalDemands: boolean('accept_external_demands').notNull().default(false),

    /** Whether to allow farmers to be visible to other cooperatives */
    shareFarmerProfiles: boolean('share_farmer_profiles').notNull().default(false),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('data_sharing_configs_cooperative_id_idx').on(table.cooperativeId)]
);

/**
 * Shared cooperative relationships.
 * Defines which cooperatives share data with each other (opt-in).
 */
export const cooperativeSharingRelations = pgTable(
  'cooperative_sharing_relations',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Cooperative that is sharing data */
    sharingCooperativeId: text('sharing_cooperative_id')
      .notNull()
      .references(() => cooperatives.id, { onDelete: 'cascade' }),

    /** Cooperative that receives the shared data */
    receivingCooperativeId: text('receiving_cooperative_id')
      .notNull()
      .references(() => cooperatives.id, { onDelete: 'cascade' }),

    /** Whether the relationship is active */
    isActive: boolean('is_active').notNull().default(true),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('cooperative_sharing_relations_sharing_idx').on(table.sharingCooperativeId),
    index('cooperative_sharing_relations_receiving_idx').on(table.receivingCooperativeId),
  ]
);

/**
 * Member invitations for joining a cooperative.
 */
export const memberInvitations = pgTable(
  'member_invitations',
  {
    /** Unique identifier (CUID) */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Cooperative the invitation is for */
    cooperativeId: text('cooperative_id')
      .notNull()
      .references(() => cooperatives.id, { onDelete: 'cascade' }),

    /** User who created the invitation */
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Role the invitee will receive */
    role: userRoleEnum('role').notNull().default('farmer'),

    /** Invitation code (6 characters, alphanumeric) */
    code: varchar('code', { length: 10 }).notNull().unique(),

    /** Email of the invitee (optional) */
    inviteeEmail: varchar('invitee_email', { length: 255 }),

    /** Name of the invitee (optional) */
    inviteeName: varchar('invitee_name', { length: 100 }),

    /** Invitation status */
    status: invitationStatusEnum('status').notNull().default('pending'),

    /** User who accepted the invitation (null if not accepted) */
    acceptedBy: text('accepted_by').references(() => users.id),

    /** When the invitation was accepted */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),

    /** Expiration date */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** Created timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /** Updated timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('member_invitations_cooperative_id_idx').on(table.cooperativeId),
    index('member_invitations_code_idx').on(table.code),
    index('member_invitations_status_idx').on(table.status),
  ]
);

export type DataSharingConfig = typeof dataSharingConfigs.$inferSelect;
export type NewDataSharingConfig = typeof dataSharingConfigs.$inferInsert;

export type CooperativeSharingRelation = typeof cooperativeSharingRelations.$inferSelect;
export type NewCooperativeSharingRelation = typeof cooperativeSharingRelations.$inferInsert;

export type MemberInvitation = typeof memberInvitations.$inferSelect;
export type NewMemberInvitation = typeof memberInvitations.$inferInsert;
