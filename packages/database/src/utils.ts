/**
 * Database Utilities
 *
 * Common utility functions for database operations.
 */

/**
 * Generates a CUID-like unique identifier.
 * Uses a combination of timestamp and random characters.
 *
 * @returns A unique identifier string
 */
export function createId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${randomPart}`;
}

/**
 * Generates a short random code.
 * Useful for cooperative codes and similar identifiers.
 *
 * @param length - Length of the code (default: 8)
 * @returns A random code string
 */
export function createCode(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
