import type { OutcomeCode } from "./types/outcome.js";

/**
 * Classifies a persist error from the agent-data-api-client as transient or client error.
 *
 * Parses the HTTP status code from the error message thrown by the API client
 * (`"Agent data API error: <status>"`). 429 and 5xx codes are transient; all
 * others are treated as non-retryable client errors.
 *
 * Network-level errors (no parseable status code, AbortError, TimeoutError) are also
 * classified as `persist_transient` because `persistNewsletterWithRetry` will have
 * already retried them before exhausting all attempts — the final error is the last
 * in a chain of transient failures, not a client/contract problem.
 *
 * Non-Error thrown values (strings, null, numbers) cannot be classified as retryable
 * and are therefore `persist_client_error`.
 *
 * @param err - Thrown value from `dataApiClient.contentGeneration.create`.
 * @returns `"persist_transient"` for 429/5xx and network-level errors;
 *          `"persist_client_error"` for 4xx (except 429) and unclassifiable values.
 */
export function classifyPersistError(
  err: unknown,
): Extract<OutcomeCode, "persist_transient" | "persist_client_error"> {
  if (err instanceof Error) {
    // AbortError / TimeoutError are transient network-level failures.
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return "persist_transient";
    }

    const match = /Agent data API error: (\d+)/.exec(err.message);
    if (match) {
      const status = parseInt(match[1] ?? "", 10);
      if (status === 429 || status >= 500) {
        return "persist_transient";
      }
      // 4xx (except 429) — client / contract error, non-retryable.
      return "persist_client_error";
    }

    // No parseable status code — treat as transient network error.
    // persistNewsletterWithRetry already retried this; it is the last of
    // a chain of transient failures, not a client problem.
    return "persist_transient";
  }

  // Non-Error thrown values cannot be classified as retryable.
  return "persist_client_error";
}
