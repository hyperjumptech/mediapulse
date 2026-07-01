import { HTTPError } from "got";
import { withRetryCustomDelay, type RetryConfig } from "@workspace/utils";

import { isRetryableError } from "../error-classification";

import type { ProviderRequestContext } from "./types";

/**
 * Upper bound on a honored `Retry-After` delay. A hostile or misconfigured provider can
 * send a very large value; without a cap it would stall the run past the fetch timeout.
 */
const RETRY_AFTER_CAP_MS = 8_000;

/**
 * Parses an HTTP `Retry-After` header value into milliseconds.
 *
 * @param value - Raw header value: delta-seconds (e.g. `"2"`) or an HTTP-date.
 * @param now - Current epoch milliseconds provider (injectable for tests).
 * @returns Delay in milliseconds, or `null` when absent or unparseable.
 */
export const parseRetryAfterMs = (
  value: string | undefined,
  now: () => number = Date.now,
): number | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) {
    return null;
  }
  const delta = dateMs - now();

  return delta > 0 ? delta : 0;
};

/**
 * Computes the delay before retrying a failed fetch attempt.
 *
 * Honors a `Retry-After` header when the error is an HTTP error (capped at
 * ``RETRY_AFTER_CAP_MS``); otherwise falls back to exponential backoff matching
 * ``withRetry``'s schedule.
 *
 * @param attempt - 1-based index of the attempt that just failed.
 * @param error - The thrown value from the fetch task.
 * @param config - Retry limits (base/max delay).
 * @returns Delay in milliseconds before the next attempt.
 */
export const retryAfterDelayMs = (
  attempt: number,
  error: unknown,
  config: RetryConfig,
): number => {
  if (error instanceof HTTPError) {
    const headerValue = error.response.headers["retry-after"];
    const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const parsed = parseRetryAfterMs(raw);
    if (parsed !== null) {
      return Math.min(parsed, RETRY_AFTER_CAP_MS);
    }
  }
  const exponential = config.baseDelayMs * Math.pow(2, attempt - 1);

  return Math.min(config.maxDelayMs, exponential);
};

/**
 * Runs a provider fetch task with retry on transient errors (429/5xx/network),
 * honoring `Retry-After`.
 *
 * - Important: shared by every fetch provider, so the `Retry-After` handling and
 *   adaptive-limiter feedback are provider-agnostic. Each retried failure is reported to
 *   the run's rate limiter so its adaptive window widens promptly instead of only after
 *   the final attempt.
 *
 * @param fetchTask - The single-attempt fetch (must itself acquire a rate-limit slot).
 * @param config - Retry limits.
 * @param ctx - Provider request context, used to feed the adaptive rate limiter.
 * @returns The resolved fetch result.
 */
export const retryFetch = <T>(
  fetchTask: () => Promise<T>,
  config: RetryConfig,
  ctx: ProviderRequestContext,
): Promise<T> =>
  withRetryCustomDelay(
    fetchTask,
    config.maxAttempts,
    ({ attempt, error }) => {
      const status =
        error instanceof HTTPError ? error.response.statusCode : undefined;
      ctx.rateLimiter.recordResponse(status);

      return retryAfterDelayMs(attempt, error, config);
    },
    isRetryableError,
  );
