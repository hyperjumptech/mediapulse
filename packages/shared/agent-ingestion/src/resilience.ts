import { createSlidingWindowRateLimiter } from "@workspace/utils";

export { type RetryConfig, withRetry } from "@workspace/utils";

const ADAPTIVE_BACKOFF_FACTOR = 1.5;
const ADAPTIVE_MAX_WINDOW_MULTIPLIER = 4;
const ADAPTIVE_SUCCESS_DECAY_THRESHOLD = 10;

/** Mutable counter shared by a provider stage for adaptive throttle events. */
export type StageThrottleStats = {
  throttleEvents: number;
};

/**
 * Returns whether an HTTP status (or missing status) indicates provider stress.
 *
 * @param status - HTTP status code when available.
 */
const isProviderStressStatus = (status?: number): boolean =>
  status === undefined || status === 429 || status >= 500;

/**
 * Limits requests to a maximum count per rolling time window with adaptive backoff.
 *
 * Backed by {@link createSlidingWindowRateLimiter} from `@workspace/utils`.
 */
export class RateLimiter {
  private readonly baselineWindowMs: number;
  private readonly maxWindowMs: number;
  private readonly cooldownWindow: number;
  private readonly limiter: ReturnType<typeof createSlidingWindowRateLimiter>;
  private currentWindowMs: number;
  private consecutiveSuccesses = 0;
  private cooldownRemaining = 0;
  private throttleEvents = 0;

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
    this.baselineWindowMs = perSeconds * 1000;
    this.maxWindowMs = this.baselineWindowMs * ADAPTIVE_MAX_WINDOW_MULTIPLIER;
    this.currentWindowMs = this.baselineWindowMs;
    this.cooldownWindow = requests;
    this.limiter = createSlidingWindowRateLimiter({
      windowMs: this.currentWindowMs,
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

  /**
   * Records provider feedback so the limiter can adapt its window for the run.
   *
   * @param status - HTTP status from the provider when available.
   */
  recordResponse(status?: number): void {
    if (isProviderStressStatus(status)) {
      this.consecutiveSuccesses = 0;
      const nextWindowMs = Math.min(
        this.maxWindowMs,
        this.currentWindowMs * ADAPTIVE_BACKOFF_FACTOR,
      );
      if (nextWindowMs > this.currentWindowMs) {
        this.currentWindowMs = nextWindowMs;
        this.limiter.setWindowMs(nextWindowMs);
        this.throttleEvents += 1;
      }
      this.cooldownRemaining = this.cooldownWindow;
      return;
    }

    if (status !== undefined && status >= 200 && status < 300) {
      this.consecutiveSuccesses += 1;
      if (
        this.consecutiveSuccesses >= ADAPTIVE_SUCCESS_DECAY_THRESHOLD &&
        this.currentWindowMs > this.baselineWindowMs &&
        this.cooldownRemaining === 0
      ) {
        this.currentWindowMs = Math.max(
          this.baselineWindowMs,
          this.currentWindowMs / ADAPTIVE_BACKOFF_FACTOR,
        );
        this.limiter.setWindowMs(this.currentWindowMs);
        this.consecutiveSuccesses = 0;
      }
    }

    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining -= 1;
    }
  }

  /**
   * Returns how many times this limiter enlarged its window during the run.
   */
  getThrottleEvents(): number {
    return this.throttleEvents;
  }

  /**
   * Returns the active sliding window length in milliseconds.
   */
  getWindowMs(): number {
    return this.limiter.getWindowMs();
  }
}
