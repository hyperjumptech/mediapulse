/**
 * Rolling lookback (hours) mirroring the source-selection window used by
 * `getDataSourcesForTicker` (`agent-data-api/src/services/content-generation.ts`).
 *
 * - Important: this must match `SOURCE_LOOKBACK_HOURS` in that service. Changing one without the
 *   other makes the newsletter-detail view disagree with what the agent could actually select.
 */
const SOURCE_LOOKBACK_HOURS = 24;

/**
 * Builds the rolling lookback window used to reconstruct the sources a newsletter could draw from,
 * so the newsletter detail handler mirrors what the content-generation agent saw at send time.
 *
 * The window is anchored on `newsletter.createdAt`: it starts `SOURCE_LOOKBACK_HOURS` before it and
 * ends at `createdAt` (the newsletter is written at the end of selection). Callers should pass
 * `windowStart` as `>=` and `windowEnd` as `<`.
 *
 * - Important: the agent selects on `DataSourceTickerSection.analyzedAt`, while this mirror queries
 *   `ArticleRelevance.scoredAt` — a related-but-distinct lifecycle timestamp. The mirror therefore
 *   approximates the agent's window on `scoredAt`; the window *shape* matches, the field does not.
 *
 * @param newsletterCreatedAt - The newsletter's `createdAt`.
 * @returns ISO strings + Dates for the [start, end) window.
 */
export const buildSelectedSourcesWindow = (
  newsletterCreatedAt: Date,
): {
  windowStart: Date;
  windowEnd: Date;
  windowStartIso: string;
  windowEndIso: string;
} => {
  const windowEnd = new Date(newsletterCreatedAt);
  const windowStart = new Date(
    windowEnd.getTime() - SOURCE_LOOKBACK_HOURS * 3_600_000,
  );
  return {
    windowStart,
    windowEnd,
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
  };
};
