import type { OutcomeCode } from "./types/outcome.js";

/**
 * Classifies a persist error from the agent-data-api-client as transient or client error.
 *
 * Parses the HTTP status code from the error message thrown by the API client
 * (`"Agent data API error: <status>"`). 429 and 5xx codes are transient; all
 * others are treated as non-retryable client errors.
 *
 * @param err - Thrown value from `dataApiClient.contentGeneration.create`.
 * @returns `"persist_transient"` for 429/5xx, `"persist_client_error"` otherwise.
 */
export function classifyPersistError(
  err: unknown,
): Extract<OutcomeCode, "persist_transient" | "persist_client_error"> {
  if (err instanceof Error) {
    const match = /Agent data API error: (\d+)/.exec(err.message);
    if (match) {
      const status = parseInt(match[1] ?? "", 10);
      if (status === 429 || status >= 500) {
        return "persist_transient";
      }
    }
  }
  return "persist_client_error";
}
