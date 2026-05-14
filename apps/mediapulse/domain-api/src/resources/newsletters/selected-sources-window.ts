/**
 * Builds the UTC calendar-day window used by
 * `getDataSourcesForTicker` (see `agent-data-api/src/services/content-generation.ts`)
 * so the newsletter detail handler mirrors what the content-generation agent
 * actually saw at send time.
 *
 * The window starts at the beginning of `newsletter.createdAt` in UTC and ends
 * 24 hours later (exclusive upper bound). Callers should pass `windowStart` as
 * `>=` and `windowEnd` as `<` when querying `ArticleRelevance.scoredAt`.
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
  const windowStart = new Date(newsletterCreatedAt);
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
  return {
    windowStart,
    windowEnd,
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
  };
};
