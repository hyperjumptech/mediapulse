import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";

import type { OutcomeCode } from "./types/outcome.js";

/**
 * Returns true when the thrown LLM error warrants a retry attempt.
 *
 * Classification table:
 * | Error                              | Retryable | OutcomeCode on final throw       |
 * |------------------------------------|-----------|----------------------------------|
 * | `APICallError` (isRetryable: true) | ✅         | `openai_retry_exhausted`         |
 * | `APICallError` (isRetryable: false)| ❌         | `openai_non_retryable`           |
 * | `TypeValidationError`              | ❌         | `validation_failed`              |
 * | `NoObjectGeneratedError`           | ❌         | `openai_invalid_response`        |
 * | `AbortError` / `TimeoutError`      | ✅         | `openai_retry_exhausted`         |
 * | Any other error                    | ❌         | `openai_non_retryable`           |
 *
 * Note: `APICallError.isRetryable` is set by the Vercel AI SDK provider; it is `true`
 * for 429 rate-limit and 5xx server errors, and `false` for 401/403 auth failures,
 * 400 bad-request, and context-length-exceeded responses.
 *
 * @param error - Thrown value from `generateObject` or an `AbortSignal` timeout.
 * @returns `true` when the caller may retry the operation.
 */
export function isRetryableLlmError(error: unknown): boolean {
  if (isAbortOrTimeoutError(error)) {
    return true;
  }
  if (error instanceof APICallError) {
    return error.isRetryable;
  }
  if (error instanceof TypeValidationError) {
    return false;
  }
  if (error instanceof NoObjectGeneratedError) {
    return false;
  }
  return false;
}

/**
 * Maps the thrown LLM error to the canonical {@link OutcomeCode}.
 *
 * Should be called after {@link retryWithBackoff} throws — either because retries were
 * exhausted on a retryable error, or because the first attempt threw a non-retryable one.
 *
 * @param error - The final thrown error from the retry-wrapped `generateObject` call.
 * @returns Canonical outcome code for the failure path.
 */
export function classifyLlmError(error: unknown): OutcomeCode {
  if (error instanceof TypeValidationError) {
    return "validation_failed";
  }
  if (error instanceof NoObjectGeneratedError) {
    return "openai_invalid_response";
  }
  if (error instanceof APICallError) {
    return error.isRetryable
      ? "openai_retry_exhausted"
      : "openai_non_retryable";
  }
  if (isAbortOrTimeoutError(error)) {
    return "openai_retry_exhausted";
  }
  return "openai_non_retryable";
}

/**
 * Returns true when the error is an `AbortError` or `TimeoutError` raised by an
 * `AbortSignal` (e.g. from `AbortSignal.timeout()` used for per-request timeouts).
 *
 * @param error - Value to test.
 * @returns `true` for abort and timeout errors.
 */
function isAbortOrTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}
