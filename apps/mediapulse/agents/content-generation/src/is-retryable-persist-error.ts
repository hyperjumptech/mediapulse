/**
 * Retryability predicate for persist errors thrown by `agent-data-api-client`.
 *
 * Classification table:
 * | Error pattern                                    | Retryable | Rationale                                     |
 * |--------------------------------------------------|-----------|-----------------------------------------------|
 * | `Agent data API error: 429`                       | ✅         | Rate-limited — back off and retry             |
 * | `Agent data API error: 5xx`                       | ✅         | Server-side transient                         |
 * | `Agent data API error: 4xx` (except 429)         | ❌         | Client / contract problem — fail fast         |
 * | Network error (no status code, e.g. ECONNREFUSED)| ✅         | Transient infrastructure issue                |
 * | AbortError / TimeoutError                         | ✅         | Request aborted or timed out — worth retrying |
 * | Non-Error thrown value                            | ❌         | Cannot classify — treat as non-retryable      |
 *
 * Differs from `classifyPersistError` which maps the *final* error to an outcome
 * code after retries are exhausted. This predicate decides whether to attempt
 * another retry; network/unparseable errors are retryable here but classified as
 * `persist_client_error` by `classifyPersistError` when retries are exhausted.
 *
 * @param error - Thrown value from `dataApiClient.contentGeneration.create`.
 * @returns `true` when the caller may retry the persist operation.
 */
export function isRetryablePersistError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // Abort / timeout errors are retryable.
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  // Parse HTTP status from the agent-data-api-client error message format.
  const match = /Agent data API error: (\d+)/.exec(error.message);
  if (match) {
    const status = parseInt(match[1] ?? "", 10);
    if (status === 429 || status >= 500) {
      return true;
    }
    // 4xx (except 429) are non-retryable client errors.
    return false;
  }

  // No parseable status code — treat as network-level transient error
  // (connection refused, timeout, DNS failure, etc.).
  return true;
}
