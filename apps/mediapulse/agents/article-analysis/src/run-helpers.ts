import type { GetAnalysisQuery } from "@workspace/agent-data-api-contract";

export type BuildAnalysisGetQueryOptions = {
  /** Passed as analysis GET `limit` (caller should use resolved Hermes `analysisGetDataSourceLimitMax`). */
  limit?: number;
};

/**
 * Builds the typed agent-data-api `analysis.get` query for an incremental run.
 *
 * @param tickerId - Hermes run input ticker id; omit for global page-collection backlog.
 * @param options - Optional `limit` to cap rows returned from agent-data-api.
 * @returns Query object for `createAgentDataApiClient().analysis.get`.
 */
export const buildAnalysisGetQuery = (
  tickerId?: string,
  options?: BuildAnalysisGetQueryOptions,
): GetAnalysisQuery => ({
  ...(tickerId !== undefined ? { tickerId } : {}),
  unanalyzed: true,
  ...(options?.limit !== undefined ? { limit: options.limit } : {}),
});

/**
 * Returns a new array sorted by `createdAt` ascending, then `id` lexicographically for stable ordering.
 *
 * @param sources - Data source rows from analysis GET (not mutated).
 * @returns Sorted copy.
 */
export const sortAnalysisDataSourcesByCreatedAt = <
  T extends { id: string; createdAt: Date | string },
>(
  sources: readonly T[],
): T[] => {
  return [...sources].sort((a, b) => {
    const ta =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : new Date(a.createdAt).getTime();
    const tb =
      b.createdAt instanceof Date
        ? b.createdAt.getTime()
        : new Date(b.createdAt).getTime();
    if (ta !== tb) {
      return ta - tb;
    }
    return a.id.localeCompare(b.id);
  });
};

/**
 * Keeps the first `maxBatchSize` items of an already-sorted list; no-op when `maxBatchSize` is omitted.
 *
 * @param sorted - Sources in deterministic process order (e.g. after {@link sortAnalysisDataSourcesByCreatedAt}).
 * @param maxBatchSize - Optional positive cap for Phase A batching.
 * @returns Possibly truncated array (same references as `sorted` when under cap or uncapped).
 */
export const applyMaxBatchSizeCap = <T>(
  sorted: readonly T[],
  maxBatchSize?: number,
): T[] => {
  if (maxBatchSize === undefined) {
    return [...sorted];
  }
  return sorted.slice(0, maxBatchSize);
};
