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

  const futureLimit = new Date(
    now.getTime() + MAX_FUTURE_TOLERANCE_DAYS * MS_PER_DAY,
  );
  if (publishedAt > futureLimit) {
    return { fresh: false, reason: "future_dated" };
  }

  const oldestAllowed = new Date(now.getTime() - maxAgeDays * MS_PER_DAY);
  if (publishedAt < oldestAllowed) {
    return { fresh: false, reason: "too_old" };
  }

  return { fresh: true };
};
