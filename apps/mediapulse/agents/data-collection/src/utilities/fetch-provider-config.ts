import type { FetchProviderConfig } from "@workspace/agent-ingestion";

import type {
  ProviderEntry,
  ProviderName,
  WebFetchConfig,
} from "./config-schema";

/** Per-provider fetch transport defaults. The config only supplies the API key. */
const FETCH_PROVIDER_DEFAULTS: Record<
  ProviderName,
  Pick<FetchProviderConfig, "baseUrl" | "authentication">
> = {
  serper: {
    baseUrl: "https://scrape.serper.dev",
    authentication: { type: "none", headerName: "X-API-KEY" },
  },
  tavily: {
    baseUrl: "https://api.tavily.com/extract",
    authentication: { type: "bearer", headerName: "Authorization" },
  },
  exa: {
    baseUrl: "https://api.exa.ai/contents",
    authentication: { type: "none", headerName: "x-api-key" },
  },
};

const FETCH_TIMEOUT_MS = 45_000;

/** Fetch providers fail fast and rely on round-robin failover instead of retrying. */
const FETCH_RETRY = {
  maxAttempts: 1,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
} as const;

/**
 * Expands one simplified `{ provider, apiKey }` entry to a full fetch provider config.
 *
 * @param entry - Provider name and API key from agent config.
 */
const toFetchProviderConfig = (entry: ProviderEntry): FetchProviderConfig => {
  const defaults = FETCH_PROVIDER_DEFAULTS[entry.provider];

  return {
    type: entry.provider,
    baseUrl: defaults.baseUrl,
    authentication: { ...defaults.authentication, apiKey: entry.apiKey },
    rateLimit: { requests: 1, perSeconds: 1 },
    concurrency: 1,
    timeoutMs: FETCH_TIMEOUT_MS,
    retry: FETCH_RETRY,
  };
};

/**
 * Builds the fetch provider configs for `performWebFetch` from agent config.
 *
 * @param webFetch - Configured web-fetch provider pool.
 */
export const buildFetchProviderConfigs = (
  webFetch: WebFetchConfig,
): FetchProviderConfig[] => webFetch.map(toFetchProviderConfig);
