/**
 * Database Connection Module
 *
 * Provides database connection with connection pooling.
 * Uses postgres.js driver with Drizzle ORM.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Database configuration options.
 */
export interface DatabaseConfig {
  /** PostgreSQL connection URL */
  connectionString: string;
  /** Maximum number of connections in the pool */
  maxConnections?: number;
  /** Idle timeout in seconds */
  idleTimeout?: number;
  /** Connection timeout in seconds */
  connectionTimeout?: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
  maxConnections: 10,
  idleTimeout: 30,
  connectionTimeout: 10,
};

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * Gets the database connection URL from environment.
 *
 * @returns Connection URL or undefined if not set
 */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

/**
 * Creates and returns the database instance.
 * Uses lazy initialization and connection pooling.
 *
 * @param config - Optional database configuration
 * @returns Drizzle database instance
 */
export function getDatabase(config?: Partial<DatabaseConfig>) {
  if (db) {
    return db;
  }

  const connectionString = config?.connectionString || getDatabaseUrl();

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const poolConfig = {
    max: config?.maxConnections ?? DEFAULT_CONFIG.maxConnections,
    idle_timeout: config?.idleTimeout ?? DEFAULT_CONFIG.idleTimeout,
    connect_timeout: config?.connectionTimeout ?? DEFAULT_CONFIG.connectionTimeout,
  };

  client = postgres(connectionString, poolConfig);
  db = drizzle(client, { schema });

  return db;
}

/**
 * Closes the database connection.
 * Should be called when the application is shutting down.
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

/**
 * Checks if the database connection is healthy.
 *
 * @returns true if connection is healthy
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const database = getDatabase();
    // Simple query to check connection
    await database.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * Type for the database instance.
 */
export type Database = ReturnType<typeof getDatabase>;
