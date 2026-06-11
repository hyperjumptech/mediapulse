/** Outcome of a data-collection agent run for reporting and HTTP response. */
export type RunStatus = "success" | "partial_success" | "failed";

/** Policy for when a run is treated as failed despite partial failures elsewhere. */
export type RunPolicy = {
  minSuccessfulSources: number;
  failOnZeroSuccess: boolean;
};

/** Aggregated counters persisted on the data-collection run record. */
export type RunCounters = {
  queriesTotal: number;
  urlsTotal: number;
  searchSuccess: number;
  searchFailed: number;
  fetchSuccess: number;
  fetchFailed: number;
  retryCount: number;
  droppedByRelevance: number;
  throttleEvents: number;
  // Extended counters — optional so existing callers are unaffected
  discovered?: number;
  afterPrefilter?: number;
  discoveryFailed?: number;
  cacheHits?: number;
  cacheMisses?: number;
  droppedByContentQuality?: Record<string, number>;
  droppedByFreshness?: number;
  droppedByFreshnessReason?: Record<string, number>;
  droppedByDeadUrl?: number;
  droppedByHostErrorRate?: number;
  droppedByFetchBudget?: number;
  droppedByRunItemCap?: number;
  droppedByExistingCanonicalUrl?: number;
  droppedByDuplicateCanonicalUrl?: number;
  droppedByUrlNoise?: number;
  fetched?: number;
  searchEmpty?: number;
  persisted?: number;
  deadlineHit?: boolean;
  durationMs?: number;
  agentId?: string;
  roundsExecuted?: number;
  stopReason?: string;
};

/**
 * Returns the derived run status based on successes, failures, and policy.
 *
 * @param totalSources - Number of successfully collected sources (fetch successes).
 * @param failureCount - Number of item-level failures recorded during the run.
 * @param runPolicy - Policy controlling when a run is considered failed.
 * @returns The derived run status.
 */
export const deriveRunStatus = ({
  totalSources,
  failureCount,
  runPolicy,
}: {
  totalSources: number;
  failureCount: number;
  runPolicy: RunPolicy;
}): RunStatus => {
  if (
    runPolicy.failOnZeroSuccess &&
    totalSources < runPolicy.minSuccessfulSources
  ) {
    return "failed";
  }

  if (failureCount > 0) {
    return "partial_success";
  }

  return "success";
};
