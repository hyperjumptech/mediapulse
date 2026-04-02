import { sleep } from "./sleep.js";

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
      const delayMs = Number.isFinite(delay) && delay >= 0 ? delay : 0;
      await sleep(delayMs);
      attempt++;
    }
  }
}

export type RetryDelayContext = {
  attempt: number;
  error: unknown;
};

/**
 * Retry helper with caller-controlled delay after each failure (before the next attempt).
 *
 * @param task - Async work to run.
 * @param maxAttempts - Total attempts (>= 1).
 * @param getDelayMs - Delay before retrying after failure `attempt` (1-based) with `error`.
 * @param isRetryable - Whether the error warrants another attempt.
 */
export async function withRetryCustomDelay<T>(
  task: () => Promise<T>,
  maxAttempts: number,
  getDelayMs: (ctx: RetryDelayContext) => number,
  isRetryable: (e: unknown) => boolean,
  options: { sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const sleepFn = options.sleepFn ?? sleep;
  const attempts = maxAttempts > 0 ? maxAttempts : 1;
  let attempt = 1;

  while (true) {
    try {
      return await task();
    } catch (e) {
      if (attempt >= attempts || !isRetryable(e)) {
        throw e;
      }
      const delayMs = getDelayMs({ attempt, error: e });
      const ms = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0;
      await sleepFn(ms);
      attempt++;
    }
  }
}
