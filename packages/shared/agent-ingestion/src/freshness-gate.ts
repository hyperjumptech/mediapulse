const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_FUTURE_TOLERANCE_DAYS = 1;

export type FreshnessDropReason = "too_old" | "future_dated" | "unknown_date";

export type FreshnessDecision =
  | { fresh: true }
  | { fresh: false; reason: FreshnessDropReason };

export type FreshnessGateConfig = {
  maxAgeDays?: number;
  allowUnknown?: boolean;
};

/**
 * Whether a publication date sits beyond the tolerated clock skew ahead of now.
 *
 * - Important: a date parsed out of body text is often not the publication date but a date the
 *   article mentions, such as when a policy takes effect. Callers that persist an extracted date
 *   use this to reject those without also applying an age limit.
 *
 * @param publishedAt - Candidate publication date.
 * @param now - Reference time.
 */
export const isFutureDated = (
  publishedAt: Date,
  now: Date = new Date(),
): boolean =>
  publishedAt.getTime() >
  now.getTime() + MAX_FUTURE_TOLERANCE_DAYS * MS_PER_DAY;

/**
 * Returns whether a page is fresh enough to persist based on its publication date.
 *
 * @param publishedAt - Extracted publication date, or `null` when unknown.
 * @param config - Freshness thresholds; unknown dates pass when `allowUnknown` is true.
 * @param now - Reference time for age calculations.
 */
export const isFresh = (
  publishedAt: Date | null,
  config: FreshnessGateConfig = {},
  now: Date = new Date(),
): FreshnessDecision => {
  const maxAgeDays = config.maxAgeDays ?? 14;
  const allowUnknown = config.allowUnknown ?? true;

  if (publishedAt === null) {
    return allowUnknown
      ? { fresh: true }
      : { fresh: false, reason: "unknown_date" };
  }

  if (isFutureDated(publishedAt, now)) {
    return { fresh: false, reason: "future_dated" };
  }

  const oldestAllowed = new Date(now.getTime() - maxAgeDays * MS_PER_DAY);
  if (publishedAt < oldestAllowed) {
    return { fresh: false, reason: "too_old" };
  }

  return { fresh: true };
};
