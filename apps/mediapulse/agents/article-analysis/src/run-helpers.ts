import type { GetAnalysisQuery } from "@workspace/agent-data-api-contract";

import type { ArticleAnalysisInput } from "./schemas/article-analysis-input-schema.js";

export type BuildAnalysisGetQueryOptions = {
  /** Passed as analysis GET `limit` (bounded by contract max). */
  limit?: number;
};

/**
 * Builds the typed agent-data-api `analysis.get` query from validated run input.
 *
 * @param input - Parsed article-analysis input (`timeWindow` bounds forward as `start` / `end` when set).
 * @param options - Optional `limit` to cap rows returned from agent-data-api.
 * @returns Query object for `createAgentDataApiClient().analysis.get`.
 */
export const buildAnalysisGetQuery = (
  input: ArticleAnalysisInput,
  options?: BuildAnalysisGetQueryOptions,
): GetAnalysisQuery => {
  const reanalyze = input.reanalyze ?? false;
  const base = {
    tickerId: input.tickerId,
    unanalyzed: !reanalyze,
    ...(options?.limit !== undefined ? { limit: options.limit } : {}),
  } satisfies Pick<GetAnalysisQuery, "tickerId" | "unanalyzed" | "limit">;

  const start = input.timeWindow?.start;
  const end = input.timeWindow?.end;
  if (start !== undefined && end !== undefined) {
    return { ...base, start, end };
  }
  if (start !== undefined) {
    return { ...base, start };
  }
  if (end !== undefined) {
    return { ...base, end };
  }
  return base;
};

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
