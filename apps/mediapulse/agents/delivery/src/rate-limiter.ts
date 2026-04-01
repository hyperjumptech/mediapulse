/** Clock used by {@link createSendRateLimiter} (injectable for tests). */
export type RateLimiterClock = {
  now: () => number;
};

export type SendRateLimiter = {
  /**
   * Waits until a send slot is available (min interval + per-minute cap).
   *
   * @returns Milliseconds waited before acquiring the slot.
   */
  acquire: () => Promise<number>;
};

/**
 * Builds a per-process rate limiter: enforces a minimum gap between sends and a rolling per-minute cap.
 *
 * @param options.minIntervalMs - Minimum time between consecutive `acquire` completions.
 * @param options.maxSendsPerMinute - Maximum sends allowed in any sliding 60s window.
 * @param options.clock - Optional clock override for deterministic tests.
 */
export function createSendRateLimiter(options: {
  minIntervalMs: number;
  maxSendsPerMinute: number;
  clock?: RateLimiterClock;
}): SendRateLimiter {
  const clock = options.clock ?? { now: () => Date.now() };
  let lastSendAt = 0;
  const windowMs = 60_000;
  const sendTimestamps: number[] = [];

  return {
    async acquire(): Promise<number> {
      let totalWaitMs = 0;
      for (;;) {
        const now = clock.now();
        while (
          sendTimestamps.length > 0 &&
          sendTimestamps[0]! < now - windowMs
        ) {
          sendTimestamps.shift();
        }

        const waitForMinInterval = Math.max(
          0,
          lastSendAt + options.minIntervalMs - now,
        );
        const waitForWindow =
          sendTimestamps.length >= options.maxSendsPerMinute
            ? Math.max(0, sendTimestamps[0]! + windowMs - now)
            : 0;
        const waitMs = Math.max(waitForMinInterval, waitForWindow);

        if (waitMs <= 0) {
          lastSendAt = now;
          sendTimestamps.push(now);
          return totalWaitMs;
        }

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        totalWaitMs += waitMs;
      }
    },
  };
}
