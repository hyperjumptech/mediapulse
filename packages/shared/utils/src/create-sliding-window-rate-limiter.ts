/** Clock used by {@link createSlidingWindowRateLimiter} (injectable for tests). */
export type SlidingWindowRateLimiterClock = {
  now: () => number;
};

export type SlidingWindowRateLimiter = {
  /**
   * Waits until a slot is available (optional minimum spacing + rolling window cap).
   *
   * @returns Milliseconds waited before acquiring the slot.
   */
  acquire: () => Promise<number>;
};

/**
 * Builds a per-process limiter: optional minimum gap between consecutive `acquire`
 * completions and a maximum number of acquisitions in a sliding time window.
 *
 * @param options.windowMs - Sliding window length in milliseconds.
 * @param options.maxInWindow - Maximum acquisitions allowed in the window.
 * @param options.minIntervalMs - Minimum time between consecutive `acquire` completions (default 0).
 * @param options.clock - Optional clock override for deterministic tests.
 */
export function createSlidingWindowRateLimiter(options: {
  windowMs: number;
  maxInWindow: number;
  minIntervalMs?: number;
  clock?: SlidingWindowRateLimiterClock;
}): SlidingWindowRateLimiter {
  if (
    !Number.isFinite(options.windowMs) ||
    options.windowMs <= 0 ||
    !Number.isFinite(options.maxInWindow) ||
    options.maxInWindow < 1
  ) {
    throw new Error(
      `createSlidingWindowRateLimiter: windowMs must be > 0 and maxInWindow >= 1 (got windowMs=${String(options.windowMs)}, maxInWindow=${String(options.maxInWindow)})`,
    );
  }
  const minIntervalMs = options.minIntervalMs ?? 0;
  if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
    throw new Error(
      `createSlidingWindowRateLimiter: minIntervalMs must be finite and >= 0 (got ${String(minIntervalMs)})`,
    );
  }
  const clock = options.clock ?? { now: () => Date.now() };
  let lastAcquireAt = 0;
  const timestamps: number[] = [];

  return {
    async acquire(): Promise<number> {
      let totalWaitMs = 0;
      for (;;) {
        const now = clock.now();
        while (
          timestamps.length > 0 &&
          timestamps[0]! < now - options.windowMs
        ) {
          timestamps.shift();
        }

        const waitForMinInterval = Math.max(
          0,
          lastAcquireAt + minIntervalMs - now,
        );
        const waitForWindow =
          timestamps.length >= options.maxInWindow
            ? Math.max(0, timestamps[0]! + options.windowMs - now)
            : 0;
        const waitMs = Math.max(waitForMinInterval, waitForWindow);

        if (waitMs <= 0) {
          lastAcquireAt = now;
          timestamps.push(now);
          return totalWaitMs;
        }

        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
        totalWaitMs += waitMs;
      }
    },
  };
}
