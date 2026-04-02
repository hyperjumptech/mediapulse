import {
  createSlidingWindowRateLimiter,
  type SlidingWindowRateLimiter,
  type SlidingWindowRateLimiterClock,
} from "@workspace/utils";

/** @deprecated Use {@link SlidingWindowRateLimiterClock} from `@workspace/utils`. */
export type RateLimiterClock = SlidingWindowRateLimiterClock;

/** @deprecated Use {@link SlidingWindowRateLimiter} from `@workspace/utils`. */
export type SendRateLimiter = SlidingWindowRateLimiter;

/**
 * Rate limiter for outbound email sends: minimum gap between sends plus a rolling per-minute cap.
 *
 * @param options.minIntervalMs - Minimum time between consecutive `acquire` completions.
 * @param options.maxSendsPerMinute - Maximum sends allowed in any sliding 60s window.
 * @param options.clock - Optional clock override for deterministic tests.
 */
export function createSendRateLimiter(options: {
  minIntervalMs: number;
  maxSendsPerMinute: number;
  clock?: SlidingWindowRateLimiterClock;
}): SendRateLimiter {
  return createSlidingWindowRateLimiter({
    windowMs: 60_000,
    maxInWindow: options.maxSendsPerMinute,
    minIntervalMs: options.minIntervalMs,
    clock: options.clock,
  });
}
