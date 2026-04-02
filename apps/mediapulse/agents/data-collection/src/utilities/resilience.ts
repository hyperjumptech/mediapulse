import { createSlidingWindowRateLimiter } from "@workspace/utils";

export { type RetryConfig, withRetry } from "@workspace/utils";

/**
 * Limits requests to a maximum count per rolling time window (no minimum spacing).
 *
 * Backed by {@link createSlidingWindowRateLimiter} from `@workspace/utils`.
 */
export class RateLimiter {
  private readonly limiter: ReturnType<typeof createSlidingWindowRateLimiter>;

  /**
   * Creates a RateLimiter that enforces a maximum number of requests per window.
   *
   * @param requests - Maximum requests.
   * @param perSeconds - Time window in seconds.
   */
  constructor(requests: number, perSeconds: number) {
    if (
      !Number.isFinite(requests) ||
      requests < 1 ||
      !Number.isFinite(perSeconds) ||
      perSeconds <= 0
    ) {
      throw new Error(
        `RateLimiter: requests and perSeconds must be finite with requests >= 1 and perSeconds > 0 (got requests=${String(requests)}, perSeconds=${String(perSeconds)})`,
      );
    }
    this.limiter = createSlidingWindowRateLimiter({
      windowMs: perSeconds * 1000,
      maxInWindow: requests,
      minIntervalMs: 0,
    });
  }

  /**
   * Blocks until a request slot is available in the current window.
   *
   * @returns Resolves when the caller may send a request.
   */
  async acquire(): Promise<void> {
    await this.limiter.acquire();
  }
}
