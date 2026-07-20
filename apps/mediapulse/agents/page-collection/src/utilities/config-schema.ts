import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

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
        "Maximum candidate URLs taken from discovery. Excess items are dropped and logged.",
      ),
    perRunCandidateBudget: z
      .number()
      .int()
      .positive()
      .default(50)
      .describe(
        "Maximum candidate URLs carried forward in a single run. Applied after dead-URL and host-breaker filtering.",
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
  resilience: resilienceSchema,
  discoveryCache: discoveryCacheSchema,
  discovery: discoverySchema,
  collection: collectionSchema,
  run: runTimingSchema,
  runPolicy: runPolicySchema,
});

export const pageCollectionAgentConfigSchema = ConfigSchema;

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

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
