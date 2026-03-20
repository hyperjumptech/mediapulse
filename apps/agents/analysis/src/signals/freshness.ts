const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Scores freshness using day-decay buckets.
 *
 * @param createdAt - Article publish/create timestamp.
 * @param now - Current time reference.
 * @returns Freshness score by age bucket.
 */
export const scoreFreshness = ({
  createdAt,
  now = new Date(),
}: {
  createdAt: Date;
  now?: Date;
}): number => {
  const diffMs = Math.max(0, now.getTime() - createdAt.getTime());
  const ageDays = Math.floor(diffMs / MS_PER_DAY);

  if (ageDays <= 0) return 1;
  if (ageDays === 1) return 0.8;
  if (ageDays === 2) return 0.6;
  if (ageDays === 3) return 0.4;
  return 0.2;
};
