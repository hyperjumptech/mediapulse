import { sleep } from "@workspace/utils";

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private timestamps: number[] = [];

  /**
   * Creates a RateLimiter that enforces a maximum number of requests per window.
   *
   * @param requests - Maximum requests.
   * @param perSeconds - Time window in seconds.
   */
  constructor(requests: number, perSeconds: number) {
    this.maxRequests = requests;
    this.windowMs = perSeconds * 1000;
  }

  /**
   * Blocks until a request slot is available in the current window.
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return Promise.resolve();
    }

    const oldest = this.timestamps[0];
    const waitTime = this.windowMs - (now - oldest!);
    await sleep(waitTime);
    return this.acquire();
  }
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Executes a task with exponential backoff retries.
 *
 * @param task - The async task to execute.
 * @param config - Retry configuration limits.
 * @param isRetryable - Predicate to determine if an error should be retried.
 * @returns The resolved value of the task.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  config: RetryConfig,
  isRetryable: (e: unknown) => boolean,
): Promise<T> {
  const maxAttempts = config.maxAttempts > 0 ? config.maxAttempts : 1;
  let attempt = 1;

  while (true) {
    try {
      return await task();
    } catch (e) {
      if (attempt >= maxAttempts || !isRetryable(e)) {
        throw e;
      }
      const delay = Math.min(
        config.maxDelayMs,
        config.baseDelayMs * Math.pow(2, attempt - 1),
      );
      await sleep(delay);
      attempt++;
    }
  }
}
