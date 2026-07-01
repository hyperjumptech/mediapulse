/**
 * Computes a random startup delay used to de-synchronize concurrent data-collection runs
 * so they don't burst the shared fetch-provider rate limit in the same instant.
 *
 * @param maxJitterMs - Upper bound (exclusive) for the delay. Non-positive or non-finite
 *   values return `0` (jitter disabled).
 * @param random - Injectable source of randomness in `[0, 1)` (defaults to `Math.random`).
 * @returns A delay in milliseconds within `[0, maxJitterMs)`.
 */
export const computeStartupJitterMs = (
  maxJitterMs: number,
  random: () => number = Math.random,
): number => {
  if (!Number.isFinite(maxJitterMs) || maxJitterMs <= 0) {
    return 0;
  }

  return Math.floor(random() * maxJitterMs);
};
