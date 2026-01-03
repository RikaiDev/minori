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

/**
 * Cooperative relations.
 */
export const cooperativesRelations = relations(cooperatives, ({ many }) => ({
  users: many(users),
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
