/**
 * Drizzle Kit Configuration
 *
 * Configuration for Drizzle Kit CLI tools (migrations, push, studio).
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema files location
  schema: './src/schema/index.ts',

  // Migration output directory
  out: './drizzle',

  // Database dialect
  dialect: 'postgresql',

  // Database connection (from environment)
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/minori',
  },

  // Verbose logging
  verbose: true,

  // Strict mode for migrations
  strict: true,
});
