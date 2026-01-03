/**
 * @minori/database
 *
 * Database schema, connection, and services for the minori platform.
 * Uses Drizzle ORM with PostgreSQL.
 */

// Schema exports
export * from './schema';

// Connection exports
export {
  getDatabase,
  closeDatabase,
  checkConnection,
  getDatabaseUrl,
  type Database,
  type DatabaseConfig,
} from './connection';

// Utility exports
export { createId, createCode } from './utils';
