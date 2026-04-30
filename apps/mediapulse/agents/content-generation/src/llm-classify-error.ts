import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { CitationValidationError } from "./llm-generate-newsletter.js";

import type { OutcomeCode } from "./types/outcome.js";

/**
 * Returns true when the thrown LLM error warrants a retry attempt.
 *
 * Classification table:
 * | Error                              | Retryable | OutcomeCode on final throw       |
 * |------------------------------------|-----------|----------------------------------|
 * | `APICallError` (isRetryable: true) | ✅         | `openai_retry_exhausted`         |
 * |   ↳ includes `AIServerError` (5xx) and `APIConnectionError`
 * | `APICallError` (isRetryable: false)| ❌         | `openai_non_retryable`           |
 * |   ↳ includes 401/403 auth, 400 bad-request, context_length_exceeded
 * | `TypeValidationError`              | ❌         | `validation_failed`              |
 * | `NoObjectGeneratedError`           | ❌         | `openai_invalid_response`        |
 * | `AbortError` / `TimeoutError`      | ✅         | `openai_retry_exhausted`         |
 * | Any other error                    | ❌         | `openai_non_retryable`           |
 *
 * Note: `APICallError.isRetryable` is set by the Vercel AI SDK provider; it is `true`
 * for 429 rate-limit and 5xx server errors (including `AIServerError`), and connection
 * errors (`APIConnectionError`), and `false` for 401/403 auth failures,
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
  if (error instanceof CitationValidationError) {
    return true;
  }
  if (error instanceof NoObjectGeneratedError) {
    return false;
  }
  return isRetryableUnknownLlmError(error);
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
  if (error instanceof CitationValidationError) {
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
  if (isRetryableUnknownLlmError(error)) {
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

/**
 * Best-effort retry classification for non-AI-SDK errors.
 *
 * Some transport/runtime failures may surface as plain `Error` objects (for
 * example from fetch/runtime boundaries) rather than `APICallError`. This
 * helper treats obvious transient network and 5xx-like signals as retryable.
 *
 * @param error - Value to classify.
 * @returns `true` when the error appears transient and worth retrying.
 */
function isRetryableUnknownLlmError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const maybeStatus = readNumericStatusCode(error);
  if (
    maybeStatus === 429 ||
    (maybeStatus !== undefined && maybeStatus >= 500)
  ) {
    return true;
  }
  return /(timed? out|timeout|econnreset|econnrefused|eai_again|enotfound|socket hang up|network error|rate limit)/i.test(
    error.message,
  );
}

/**
 * Reads a numeric status code from common error object shapes.
 *
 * @param error - Error instance that may include status fields.
 * @returns Status code when present; otherwise `undefined`.
 */
function readNumericStatusCode(error: Error): number | undefined {
  const asRecord = error as unknown as Record<string, unknown>;
  const direct = asRecord.statusCode ?? asRecord.status;
  if (typeof direct === "number") {
    return direct;
  }
  if (
    asRecord.cause &&
    typeof asRecord.cause === "object" &&
    asRecord.cause !== null
  ) {
    const causeRecord = asRecord.cause as Record<string, unknown>;
    const nested = causeRecord.statusCode ?? causeRecord.status;
    if (typeof nested === "number") {
      return nested;
    }
  }
  return undefined;
}
