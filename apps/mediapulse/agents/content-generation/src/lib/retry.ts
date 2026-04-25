import { withRetryCustomDelay } from "@workspace/utils";

/** Configuration for LLM retry with exponential backoff and optional jitter. */
export type LlmRetryConfig = {
  /** Maximum total attempts (including the first). Must be >= 1. */
  maxAttempts: number;
  /** Base delay in milliseconds used for the first retry interval. */
  baseDelayMs: number;
  /** Upper bound on any computed delay in milliseconds. */
  maxDelayMs: number;
  /** When true, applies ±50% random jitter to each computed backoff delay. */
  jitter: boolean;
};

/**
 * Computes the exponential backoff delay for a given attempt, with optional jitter.
 *
 * The base delay doubles each attempt: `baseDelayMs * 2^(attempt - 1)`, capped at
 * `maxDelayMs`. When `jitter` is true, the result is randomised in the range
 * `[0.5 × base, 1.5 × base]` (still capped at `maxDelayMs`).
 *
 * @param attempt - 1-based failure attempt number (first failure = 1).
 * @param config - Retry config supplying base delay, max delay, and jitter flag.
 * @param random - Returns a value in [0, 1); defaults to `Math.random` for production.
 * @returns Delay in milliseconds before the next attempt.
 */
export function expBackoffWithJitter(
  attempt: number,
  config: Pick<LlmRetryConfig, "baseDelayMs" | "maxDelayMs" | "jitter">,
  random: () => number = Math.random,
): number {
  const base = Math.min(
    config.maxDelayMs,
    config.baseDelayMs * Math.pow(2, attempt - 1),
  );

  if (!config.jitter) {
    return base;
  }

  // ±50% jitter: delay in [0.5 × base, 1.5 × base], still capped at maxDelayMs
  const jitterFactor = 0.5 + random();
  return Math.min(config.maxDelayMs, Math.floor(base * jitterFactor));
}

/**
 * Retries an async task with exponential backoff and optional jitter.
 *
 * Delegates scheduling to `withRetryCustomDelay` from `@workspace/utils`.
 * Inject `options.sleepFn` with a no-op in tests to avoid real delays.
 * Inject `options.random` to make jitter deterministic in tests.
 *
 * @param task - Async task to execute and retry on retryable failures.
 * @param config - LLM retry configuration (maxAttempts, delays, jitter).
 * @param isRetryable - Returns true when a thrown error warrants another attempt.
 * @param options - Optional DI overrides for sleepFn and random number generator.
 * @returns The resolved value of the task on success.
 * @throws The last thrown error when all attempts are exhausted or the error is non-retryable.
 */
export async function retryWithBackoff<T>(
  task: () => Promise<T>,
  config: LlmRetryConfig,
  isRetryable: (e: unknown) => boolean,
  options: {
    sleepFn?: (ms: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<T> {
  const random = options.random ?? Math.random;
  return withRetryCustomDelay(
    task,
    config.maxAttempts,
    ({ attempt }) => expBackoffWithJitter(attempt, config, random),
    isRetryable,
    { sleepFn: options.sleepFn },
  );
}
