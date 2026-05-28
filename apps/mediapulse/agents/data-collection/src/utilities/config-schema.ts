import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const concurrencySchema = z
  .number()
  .int()
  .min(1)
  .max(16)
  .default(4)
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

const defaultRetry = {
  maxAttempts: 3,
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

const searchProviderSchema = z.object({
  baseUrl: z
    .string()
    .default("https://google.serper.dev/search")
    .describe("Serper search endpoint that accepts POST { q }."),
  authentication: z
    .object({
      type: z.enum(["bearer", "none"]).default("none"),
      apiKey: z.string().default("{{SERPER_API_KEY}}"),
      headerName: z.string().default("X-API-KEY"),
    })
    .default({
      type: "none",
      apiKey: "{{SERPER_API_KEY}}",
      headerName: "X-API-KEY",
    })
    .describe("Serper credentials resolved from Hermes Variables."),
  rateLimit: z
    .object({
      requests: z.number().int().positive().default(100),
      perSeconds: z.number().positive().default(60),
    })
    .default({ requests: 100, perSeconds: 60 })
    .describe("Sliding-window request budget for web search."),
  concurrency: concurrencySchema,
  timeoutMs: z
    .number()
    .int()
    .positive()
    .default(30_000)
    .optional()
    .describe("HTTP request timeout in milliseconds."),
  retry: retrySchema.default(defaultRetry).optional(),
});

export const fetchProviderConfigSchema = z.object({
  type: z
    .string()
    .describe("Fetch adapter identifier such as diffbot, firecrawl, or jina."),
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
  retry: retrySchema.default(defaultRetry).optional(),
});

/** Recommended Diffbot provider defaults for the fetch chain. */
export const defaultDiffbotFetchProvider = {
  type: "diffbot",
  baseUrl: "https://api.diffbot.com",
  authentication: {
    type: "none" as const,
    apiKey: "{{DIFFBOT_API_KEY}}",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 2,
  timeoutMs: 30_000,
  retry: defaultRetry,
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
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 2,
  timeoutMs: 30_000,
  retry: defaultRetry,
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
  concurrency: 2,
  timeoutMs: 30_000,
  retry: defaultRetry,
};

/** Default ordered fetch-provider chain: Diffbot, then Firecrawl, then Jina. */
export const defaultFetchProviders = [
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
    search: searchProviderSchema
      .default({})
      .describe("Serper web-search provider settings."),
    fetch: fetchProvidersSchema
      .default({})
      .describe("Ordered web-fetch provider chain settings."),
  })
  .default({})
  .describe("External search and fetch providers used by the pipeline.");

const collectionSchema = z
  .object({
    targetDailySuccessfulSources: z
      .number()
      .int()
      .positive()
      .default(5)
      .describe(
        "Stop refill rounds once this many successful sources exist for the ticker today (UTC).",
      ),
    maxRefillRounds: z
      .number()
      .int()
      .nonnegative()
      .default(3)
      .describe(
        "Additional search-and-fetch rounds after the initial round when the daily target is not yet met.",
      ),
    perQueryFetchBudget: z
      .number()
      .int()
      .positive()
      .default(3)
      .describe("Maximum URLs fetched per search query after ranking."),
    perRunFetchBudget: z
      .number()
      .int()
      .positive()
      .default(40)
      .describe("Maximum URLs fetched across all queries in one round."),
  })
  .default({})
  .describe("Collection volume and refill behavior.");

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
    .default(1500)
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

const semanticDedupeSchema = z.object({
  enabled: z
    .boolean()
    .default(true)
    .describe(
      "When enabled, drop near-duplicate pages using embedding similarity against recent corpus fingerprints.",
    ),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.88)
    .describe(
      "Cosine-similarity threshold above which a candidate is dropped.",
    ),
  windowDays: z
    .number()
    .int()
    .positive()
    .default(7)
    .describe("Lookback window in days for recent corpus fingerprints."),
  embeddingModel: z
    .string()
    .default("{{EMBEDDING_MODEL}}")
    .describe(
      "OpenAI embedding model name or a Hermes variable placeholder such as {{EMBEDDING_MODEL}}.",
    ),
});

const deduplicationSchema = z
  .object({
    semantic: semanticDedupeSchema
      .default({})
      .describe("Semantic deduplication against recently persisted sources."),
    openaiApiKey: z
      .string()
      .default("{{OPENAI_API_KEY}}")
      .describe(
        "OpenAI API key for semantic dedupe embeddings or a Hermes variable placeholder.",
      ),
  })
  .default({})
  .describe("Deduplication settings and credentials.");

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
      .default(true)
      .describe(
        "When true, a run with zero persisted sources is marked failed even if no HTTP errors occurred.",
      ),
  })
  .default({})
  .describe("Run success criteria applied after the pipeline completes.");

/** Zod schema for agent config grouped for Hermes form sections. */
export const ConfigSchema = z.object({
  providers: providersSchema,
  collection: collectionSchema,
  gates: gatesSchema,
  resilience: resilienceSchema,
  deduplication: deduplicationSchema,
  runPolicy: runPolicySchema,
});

export const dataCollectionAgentConfigSchema = ConfigSchema;

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

export type SearchProviderConfig = ConfigSchemaType["providers"]["search"];
export type FetchProvidersConfig = ConfigSchemaType["providers"]["fetch"];

/**
 * Minimal JSON Schema type used for the /config response.
 * This is intentionally loose to avoid over-constraining the runtime representation.
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
  agentId: "data-collection";
  schema: JsonSchema;
} {
  const schema = zodToJsonSchema(ConfigSchema) as JsonSchema;

  return {
    agentId: "data-collection",
    schema,
  };
}
