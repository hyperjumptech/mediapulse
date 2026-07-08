import type { FetchProviderConfig } from "@workspace/agent-ingestion";

import type {
  FetchProviderEntry,
  FetchProviderName,
  WebFetchConfig,
} from "./config-schema";

/** Per-provider fetch transport defaults. The config only supplies the API key. */
const FETCH_PROVIDER_DEFAULTS: Record<
  Exclude<FetchProviderName, "firecrawl_selfhosted">,
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
  diffbot: {
    baseUrl: "https://api.diffbot.com",
    authentication: { type: "none" },
  },
  firecrawl: {
    baseUrl: "https://api.firecrawl.dev",
    authentication: { type: "bearer", headerName: "Authorization" },
  },
  jina: {
    baseUrl: "https://r.jina.ai/",
    authentication: { type: "bearer", headerName: "Authorization" },
  },
};

const FETCH_TIMEOUT_MS = 45_000;

/**
 * Fetch providers retry transient failures (HTTP 429/5xx, network) a few times with
 * backoff that honors `Retry-After`, then fall through to round-robin failover. Only one
 * provider is typically configured, so retry is the primary containment for rate limiting.
 * `maxDelayMs` is kept well under `FETCH_TIMEOUT_MS` so a single backoff can't wedge the run.
 */
const FETCH_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8_000,
} as const;

/**
 * Expands one config entry to a full fetch provider config. API-key providers use
 * fixed transport defaults; the self-hosted provider uses its own base URL and headers.
 *
 * @param entry - Fetch provider entry from agent config.
 */
const toFetchProviderConfig = (
  entry: FetchProviderEntry,
): FetchProviderConfig => {
  if (entry.provider === "firecrawl_selfhosted") {
    return {
      type: entry.provider,
      baseUrl: entry.baseUrl,
      authentication: { type: "none" },
      ...(entry.headers ? { headers: entry.headers } : {}),
      rateLimit: { requests: 1, perSeconds: 1 },
      concurrency: 1,
      timeoutMs: FETCH_TIMEOUT_MS,
      retry: FETCH_RETRY,
    };
  }

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
