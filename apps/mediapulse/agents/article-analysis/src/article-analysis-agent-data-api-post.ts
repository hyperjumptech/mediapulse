import type {
  ArticleAnalysisPostChunkKind,
  ArticleAnalysisPostFailureRecord,
} from "./article-analysis-run-policy.js";

const agentDataApiErrorPattern = /^Agent data API error: (\d+)(?:\b|$)/;

/**
 * Parses HTTP status from {@link createAgentDataApiClient} POST errors, when present.
 *
 * @param error - Thrown value from `analysis.create`.
 * @returns Status code, or `undefined` if not an HTTP error message from the client.
 */
export const parseAgentDataApiHttpStatus = (
  error: unknown,
): number | undefined => {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const match = agentDataApiErrorPattern.exec(error.message);
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
};

/**
 * Returns true when a failed request may succeed on retry (429 or 5xx).
 *
 * @param status - Parsed HTTP status, if any.
 * @returns Whether the client may retry the same payload.
 */
export const isTransientAgentDataApiHttpStatus = (
  status: number | undefined,
): boolean => {
  if (status === undefined) {
    return false;
  }
  if (status === 429) {
    return true;
  }
  return status >= 500 && status <= 599;
};

/**
 * Builds a structured POST failure record without logging article bodies or secrets.
 *
 * @param chunkKind - POST phase.
 * @param chunkIndex - Index within that phase’s loop.
 * @param error - Thrown error from `analysis.create`.
 * @returns Serializable failure row for `details.postFailures`.
 */
export const toArticleAnalysisPostFailureRecord = (
  chunkKind: ArticleAnalysisPostChunkKind,
  chunkIndex: number,
  error: unknown,
): ArticleAnalysisPostFailureRecord => {
  const httpStatus = parseAgentDataApiHttpStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  return {
    chunkKind,
    chunkIndex,
    errorCategory: httpStatus !== undefined ? "agent_data_api_http" : "unknown",
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    message,
  };
};

export type TransientRetryDeps = {
  /** Number of retries after the first attempt (0 = no retries). */
  maxRetries: number;
  /** Initial backoff; delay doubles each retry (`base * 2^attempt`). */
  baseDelayMs: number;
  /** Injectable sleep for tests. */
  sleep: (ms: number) => Promise<void>;
};

/**
 * Runs an async POST operation, retrying only on transient HTTP statuses from the agent-data-api client.
 *
 * @param operation - Typically `() => dataApiClient.analysis.create(body)`.
 * @param deps - Retry limits and sleep injection.
 * @returns The fulfilled result from `operation`.
 * @throws The last error when non-transient or retries are exhausted.
 */
export const executeAnalysisCreateWithTransientRetries = async <T>(
  operation: () => Promise<T>,
  deps: TransientRetryDeps,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= deps.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      const status = parseAgentDataApiHttpStatus(e);
      const mayRetry =
        attempt < deps.maxRetries && isTransientAgentDataApiHttpStatus(status);
      if (!mayRetry) {
        throw e;
      }
      await deps.sleep(deps.baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
};
