import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const concurrencySchema = z
  .number()
  .int()
  .min(1)
  .max(16)
  .default(2)
  .describe("Maximum parallel requests for this stage.");

const retrySchema = z
  .object({
    maxAttempts: z
      .number()
      .int()
      .nonnegative()
      .describe("Maximum retry attempts after a retryable failure."),
    baseDelayMs: z
      .number()
      .int()
      .positive()
      .describe("Initial backoff delay in milliseconds."),
    maxDelayMs: z
      .number()
      .int()
      .positive()
      .describe("Maximum backoff delay in milliseconds."),
  })
  .describe("Retry policy for transient HTTP failures.");

/** Fetch providers fail fast and rely on the ordered provider chain for fallback. */
const fetchDefaultRetry = {
  maxAttempts: 1,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
} as const;

const authenticationSchema = z.object({
  type: z
    .enum(["bearer", "none"])
    .describe("Authentication style for outbound provider requests."),
  apiKey: z
    .string()
    .optional()
    .describe(
      "Provider API key or a Hermes variable placeholder such as {{SERPER_API_KEY}}.",
    ),
  headerName: z
    .string()
    .optional()
    .describe("HTTP header name when the provider expects a header token."),
});

const rateLimitSchema = z.object({
  requests: z
    .number()
    .int()
    .positive()
    .describe("Maximum requests allowed within the sliding window."),
  perSeconds: z
    .number()
    .positive()
    .describe("Sliding window length in seconds for rate limiting."),
});

export const fetchProviderConfigSchema = z.object({
  type: z
    .string()
    .describe(
      "Fetch adapter identifier such as serper, diffbot, firecrawl, or jina.",
    ),
  baseUrl: z.string().describe("Provider base URL for this adapter."),
  authentication: authenticationSchema.describe(
    "Provider credentials or Hermes variable placeholders.",
  ),
  rateLimit: rateLimitSchema.describe(
    "Sliding-window request budget for this fetch provider.",
  ),
  concurrency: concurrencySchema,
  timeoutMs: z
    .number()
    .int()
    .positive()
    .default(30_000)
    .optional()
    .describe("HTTP request timeout in milliseconds."),
  retry: retrySchema.default(fetchDefaultRetry).optional(),
});

/** Recommended Serper scrape provider defaults for the fetch chain. */
export const defaultSerperFetchProvider = {
  type: "serper",
  baseUrl: "https://scrape.serper.dev",
  authentication: {
    type: "none" as const,
    apiKey: "{{SERPER_API_KEY}}",
    headerName: "X-API-KEY",
  },
  rateLimit: { requests: 1, perSeconds: 1 },
  concurrency: 1,
  timeoutMs: 45_000,
  retry: fetchDefaultRetry,
};

/** Recommended Diffbot provider defaults for the fetch chain. */
export const defaultDiffbotFetchProvider = {
  type: "diffbot",
  baseUrl: "https://api.diffbot.com",
  authentication: {
    type: "none" as const,
    apiKey: "{{DIFFBOT_API_KEY}}",
  },
  rateLimit: { requests: 1, perSeconds: 1 },
  concurrency: 1,
  timeoutMs: 45_000,
  retry: fetchDefaultRetry,
};

/** Recommended Firecrawl provider defaults for the fetch chain. */
export const defaultFirecrawlFetchProvider = {
  type: "firecrawl",
  baseUrl: "https://api.firecrawl.dev",
  authentication: {
    type: "bearer" as const,
    apiKey: "{{FIRECRAWL_API_KEY}}",
    headerName: "Authorization",
  },
  rateLimit: { requests: 1, perSeconds: 1 },
  concurrency: 1,
  timeoutMs: 45_000,
  retry: fetchDefaultRetry,
};

/** Recommended Jina provider defaults for the fetch chain. */
export const defaultJinaFetchProvider = {
  type: "jina",
  baseUrl: "https://r.jina.ai/",
  authentication: {
    type: "bearer" as const,
    apiKey: "{{JINA_API_KEY}}",
    headerName: "Authorization",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 1,
  timeoutMs: 45_000,
  retry: fetchDefaultRetry,
};

/** Default ordered fetch-provider chain: Serper, then Diffbot, then Firecrawl, then Jina. */
export const defaultFetchProviders = [
  defaultSerperFetchProvider,
  defaultDiffbotFetchProvider,
  defaultFirecrawlFetchProvider,
  defaultJinaFetchProvider,
] as const;

const fetchProvidersSchema = z.object({
  providers: z
    .array(fetchProviderConfigSchema)
    .min(1)
    .default([...defaultFetchProviders])
    .describe(
      "Ordered fetch-provider chain. The first provider is tried for each URL; later providers run only after earlier failures.",
    ),
});

const providersSchema = z
  .object({
    fetch: fetchProvidersSchema
      .default({})
      .describe("Ordered web-fetch provider chain settings."),
  })
  .default({})
  .describe("External fetch providers used by the pipeline.");

const discoveryStrategyEnum = z.enum(["rss", "sitemap", "generic-links"]);

const curatedSourceSchema = z.object({
  listingUrl: z.string().url().describe("URL of the listing page or feed."),
  strategies: z
    .array(discoveryStrategyEnum)
    .nonempty()
    .optional()
    .describe(
      "Ordered strategy chain override for this source. Omit to inherit defaultDiscoveryChain.",
    ),
  enabled: z
    .boolean()
    .default(true)
    .describe("When false, this source is skipped during discovery."),
  maxItems: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum items to return from this source per run."),
});

const relevanceGateSchema = z.object({
  enabled: z
    .boolean()
    .default(true)
    .describe(
      "When enabled, pages must mention the ticker or industry aliases.",
    ),
  headChars: z
    .number()
    .int()
    .positive()
    .default(3000)
    .describe(
      "Number of leading content characters scanned for alias matches.",
    ),
  minMatches: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Minimum alias matches required to keep a page."),
});

const freshnessGateSchema = z.object({
  enabled: z
    .boolean()
    .default(true)
    .describe("When enabled, pages outside the freshness window are dropped."),
  maxAgeDays: z
    .number()
    .int()
    .positive()
    .default(14)
    .describe("Maximum article age in days when a publish date is known."),
  allowUnknown: z
    .boolean()
    .default(true)
    .describe("Keep pages when no publish date can be extracted."),
});

const gatesSchema = z
  .object({
    relevance: relevanceGateSchema
      .default({})
      .describe("Ticker and industry relevance filtering."),
    freshness: freshnessGateSchema
      .default({})
      .describe("Publish-date freshness filtering."),
  })
  .default({})
  .describe("Pre-persistence content gates.");

const deadUrlCacheSchema = z.object({
  enabled: z
    .boolean()
    .default(true)
    .describe("Skip URLs previously recorded as dead after fetch failures."),
  skipLookupBatchSize: z
    .number()
    .int()
    .positive()
    .default(50)
    .describe("Batch size for dead-URL negative-cache lookups."),
});

const hostErrorBreakerSchema = z.object({
  enabled: z
    .boolean()
    .default(true)
    .describe(
      "Skip hosts whose recent fetch error rate exceeds the threshold.",
    ),
  minAttempts: z
    .number()
    .int()
    .positive()
    .default(5)
    .describe("Minimum fetch attempts on a host before the breaker can trip."),
  errorRateThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe("Host error rate above which further fetches are skipped."),
});

const resilienceSchema = z
  .object({
    deadUrlCache: deadUrlCacheSchema
      .default({})
      .describe("Negative cache for URLs that repeatedly fail to fetch."),
    hostErrorBreaker: hostErrorBreakerSchema
      .default({})
      .describe("Per-host circuit breaker based on fetch error rate."),
  })
  .default({})
  .describe("Failure-avoidance controls applied before and during fetch.");

const runPolicySchema = z
  .object({
    minSuccessfulSources: z
      .number()
      .int()
      .nonnegative()
      .default(1)
      .describe("Minimum persisted sources required for a successful run."),
    failOnZeroSuccess: z
      .boolean()
      .default(false)
      .describe(
        "When true, a run with zero persisted sources is marked failed even if no HTTP errors occurred.",
      ),
  })
  .default({})
  .describe("Run success criteria applied after the pipeline completes.");

const discoveryCacheSchema = z
  .object({
    enabled: z
      .boolean()
      .default(false)
      .describe(
        "When enabled, discovery results are cached by listing URL to avoid re-scraping the same feed across tickers in the same cycle.",
      ),
    ttlSeconds: z
      .number()
      .int()
      .positive()
      .default(3600)
      .describe(
        "Cache TTL in seconds. Should be set near the schedule interval so breaking news is not stale across cycles.",
      ),
  })
  .default({})
  .describe("Cross-ticker listing discovery cache settings.");

const discoverySchema = z
  .object({
    concurrency: z
      .number()
      .int()
      .min(1)
      .max(16)
      .default(4)
      .describe("Maximum number of listing sources scraped concurrently."),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .default(30_000)
      .describe(
        "Per-strategy HTTP timeout in milliseconds. A hung request is aborted and falls through the strategy chain.",
      ),
  })
  .default({})
  .describe("Discovery stage concurrency and timeout settings.");

const collectionSchema = z
  .object({
    maxDiscoveredItemsPerRun: z
      .number()
      .int()
      .positive()
      .default(500)
      .describe(
        "Maximum candidate URLs taken from discovery before fetch. Excess items are dropped and logged.",
      ),
    perRunFetchBudget: z
      .number()
      .int()
      .positive()
      .default(50)
      .describe(
        "Maximum URLs sent to the fetch stage in a single run. Applied after dead-URL and host-breaker filtering.",
      ),
  })
  .default({})
  .describe("Per-run collection caps.");

const runTimingSchema = z
  .object({
    maxDurationMs: z
      .number()
      .int()
      .positive()
      .default(300_000)
      .describe(
        "Overall run deadline in milliseconds. When exceeded the run stops starting new fetches and finalizes with partial_success.",
      ),
  })
  .default({})
  .describe("Run-level timing and deadline settings.");

/** Zod schema for agent config grouped for Hermes form sections. */
export const ConfigSchema = z.object({
  curatedSources: z
    .array(curatedSourceSchema)
    .default([])
    .describe(
      "Operator-managed listing sources. Each entry is a feed or listing page the agent discovers articles from.",
    ),
  defaultDiscoveryChain: z
    .array(discoveryStrategyEnum)
    .nonempty()
    .default(["rss", "sitemap", "generic-links"])
    .describe(
      "Ordered discovery strategy chain applied to sources that do not override their own chain.",
    ),
  providers: providersSchema,
  gates: gatesSchema,
  resilience: resilienceSchema,
  discoveryCache: discoveryCacheSchema,
  discovery: discoverySchema,
  collection: collectionSchema,
  run: runTimingSchema,
  runPolicy: runPolicySchema,
});

export const pageCollectionAgentConfigSchema = ConfigSchema;

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

export type FetchProvidersConfig = ConfigSchemaType["providers"]["fetch"];

/**
 * Minimal JSON Schema type used for the /config response.
 */
export type JsonSchema = {
  [key: string]: unknown;
};

/**
 * Returns whether a config value is an unresolved Hermes variable placeholder.
 *
 * @param value - Config string that may still contain `{{NAME}}` syntax.
 */
export const isUnresolvedVariablePlaceholder = (value: string): boolean =>
  /^\{\{[A-Z0-9_]+\}\}$/.test(value);

/**
 * Returns the JSON Schema representation of the config schema wrapped with the agent ID.
 */
export function getConfigSchema(): {
  agentId: "page-collection";
  schema: JsonSchema;
} {
  const schema = zodToJsonSchema(ConfigSchema) as JsonSchema;

  return {
    agentId: "page-collection",
    schema,
  };
}
