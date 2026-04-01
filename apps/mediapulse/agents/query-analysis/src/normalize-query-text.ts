/**
 * Normalizes free-text search queries for deduplication (trim + collapse whitespace + lowercase).
 *
 * @param text - Raw query string.
 * @returns Comparable key string.
 */
export const normalizeQueryTextKey = (text: string): string =>
  text.trim().replace(/\s+/g, " ").toLowerCase();
