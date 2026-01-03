/**
 * Database Relations
 *
 * Defines relationships between tables for Drizzle ORM.
 * Enables type-safe joins and nested queries.
 */

import { relations } from 'drizzle-orm';
import { cooperatives } from './cooperatives';
import { users } from './users';
import { fields } from './fields';
import { plantingRecords } from './planting-records';
import { harvestRecords } from './harvest-records';
import { growthRecords } from './growth-records';
import { demands } from './demands';
import { matches } from './matches';
import {
  dataSharingConfigs,
  cooperativeSharingRelations as sharingRelationsTable,
  memberInvitations,
} from './tenant';
import { notifications, notificationPreferences } from './notifications';

/**
 * Cooperative relations.
 */
export const cooperativesRelations = relations(cooperatives, ({ one, many }) => ({
  users: many(users),
  demands: many(demands),
  matches: many(matches),
  dataSharingConfig: one(dataSharingConfigs, {
    fields: [cooperatives.id],
    references: [dataSharingConfigs.cooperativeId],
  }),
  memberInvitations: many(memberInvitations),
  sharingTo: many(sharingRelationsTable, { relationName: 'sharingCooperative' }),
  receivingFrom: many(sharingRelationsTable, { relationName: 'receivingCooperative' }),
}));

/**
 * User relations.
 */
export const usersRelations = relations(users, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [users.cooperativeId],
    references: [cooperatives.id],
  }),
  fields: many(fields),
  plantingRecords: many(plantingRecords),
  harvestRecords: many(harvestRecords),
  demands: many(demands),
  matchesAsFarmer: many(matches),
  sentInvitations: many(memberInvitations, { relationName: 'inviter' }),
}));

/**
 * Field relations.
 */
export const fieldsRelations = relations(fields, ({ one, many }) => ({
  user: one(users, {
    fields: [fields.userId],
    references: [users.id],
  }),
  plantingRecords: many(plantingRecords),
}));

/**
 * Planting record relations.
 */
export const plantingRecordsRelations = relations(plantingRecords, ({ one, many }) => ({
  user: one(users, {
    fields: [plantingRecords.userId],
    references: [users.id],
  }),
  field: one(fields, {
    fields: [plantingRecords.fieldId],
    references: [fields.id],
  }),
  harvestRecords: many(harvestRecords),
  growthRecords: many(growthRecords),
  matches: many(matches),
}));

/**
 * Harvest record relations.
 */
export const harvestRecordsRelations = relations(harvestRecords, ({ one }) => ({
  plantingRecord: one(plantingRecords, {
    fields: [harvestRecords.plantingRecordId],
    references: [plantingRecords.id],
  }),
  user: one(users, {
    fields: [harvestRecords.userId],
    references: [users.id],
  }),
}));

/**
 * Growth record relations.
 */
export const growthRecordsRelations = relations(growthRecords, ({ one }) => ({
  plantingRecord: one(plantingRecords, {
    fields: [growthRecords.plantingRecordId],
    references: [plantingRecords.id],
  }),
}));

/**
 * Demand relations.
 */
export const demandsRelations = relations(demands, ({ one, many }) => ({
  buyer: one(users, {
    fields: [demands.buyerId],
    references: [users.id],
  }),
  cooperative: one(cooperatives, {
    fields: [demands.cooperativeId],
    references: [cooperatives.id],
  }),
  matches: many(matches),
}));

/**
 * Match relations.
 */
export const matchesRelations = relations(matches, ({ one }) => ({
  demand: one(demands, {
    fields: [matches.demandId],
    references: [demands.id],
  }),
  plantingRecord: one(plantingRecords, {
    fields: [matches.plantingRecordId],
    references: [plantingRecords.id],
  }),
  farmer: one(users, {
    fields: [matches.farmerId],
    references: [users.id],
  }),
  cooperative: one(cooperatives, {
    fields: [matches.cooperativeId],
    references: [cooperatives.id],
  }),
}));

/**
 * Data sharing config relations.
 */
export const dataSharingConfigsRelations = relations(dataSharingConfigs, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [dataSharingConfigs.cooperativeId],
    references: [cooperatives.id],
  }),
}));

/**
 * Cooperative sharing relations.
 */
export const cooperativeSharingRelationsRelations = relations(sharingRelationsTable, ({ one }) => ({
  sharingCooperative: one(cooperatives, {
    fields: [sharingRelationsTable.sharingCooperativeId],
    references: [cooperatives.id],
    relationName: 'sharingCooperative',
  }),
  receivingCooperative: one(cooperatives, {
    fields: [sharingRelationsTable.receivingCooperativeId],
    references: [cooperatives.id],
    relationName: 'receivingCooperative',
  }),
}));

/**
 * Member invitation relations.
 */
export const memberInvitationsRelations = relations(memberInvitations, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [memberInvitations.cooperativeId],
    references: [cooperatives.id],
  }),
  inviter: one(users, {
    fields: [memberInvitations.invitedBy],
    references: [users.id],
    relationName: 'inviter',
  }),
  acceptedByUser: one(users, {
    fields: [memberInvitations.acceptedBy],
    references: [users.id],
  }),
}));

/**
 * Notification relations.
 */
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  cooperative: one(cooperatives, {
    fields: [notifications.cooperativeId],
    references: [cooperatives.id],
  }),
}));

/**
 * Notification preferences relations.
 */
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));
