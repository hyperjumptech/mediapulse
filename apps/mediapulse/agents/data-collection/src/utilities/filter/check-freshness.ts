import {
  extractPublishedDate,
  isFresh,
  type ExtractPublishedDateInput,
  type FreshnessDecision,
} from "@workspace/agent-ingestion";

/** Default freshness window in days. Pages older than this are dropped. */
export const FRESHNESS_MAX_AGE_DAYS = 7;

export interface FreshnessCheckResult {
  decision: FreshnessDecision;
  publishedAt: Date | null;
}

/**
 * Extracts the publish date and drops pages older than the freshness window.
 * Pages with no detectable date are kept.
 *
 * @param input - Fetch metadata and content used to extract a publish date.
 * @param maxAgeDays - Freshness window in days.
 */
export const checkFreshness = (
  input: ExtractPublishedDateInput,
  maxAgeDays: number = FRESHNESS_MAX_AGE_DAYS,
): FreshnessCheckResult => {
  const publishedAt = extractPublishedDate(input);
  const decision = isFresh(publishedAt, { maxAgeDays, allowUnknown: true });

  return { decision, publishedAt };
};
