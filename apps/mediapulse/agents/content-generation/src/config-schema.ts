import { z } from "zod";

import type { NewsletterSectionId } from "@workspace/agent-data-api-contract";

const modelSchema = z
  .object({
    apiKey: z
      .string()
      .default("{{AI_API_KEY}}")
      .describe("OpenAI-compatible API key for newsletter generation."),
    model: z
      .string()
      .default("{{AI_MODEL}}")
      .describe("Model id for newsletter generation."),
    baseUrl: z
      .string()
      .default("{{AI_BASE_URL}}")
      .describe(
        "OpenAI-compatible base URL (for example an OpenRouter gateway).",
      ),
  })
  .default({})
  .describe("LLM credentials for newsletter generation.");

const duplicateGuardSchema = z
  .object({
    timezone: z
      .string()
      .refine(
        (tz) => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        },
        { message: "Invalid IANA timezone" },
      )
      .default("Asia/Jakarta")
      .describe(
        "IANA timezone for the one-newsletter-per-calendar-day precheck (e.g. Asia/Jakarta).",
      ),
  })
  .default({})
  .describe(
    "Skip-if-duplicate precheck window (one newsletter per ticker per calendar day in timezone).",
  );

const fetchDefaultRetry = {
  maxAttempts: 1,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
} as const;

const fetchAuthenticationSchema = z.object({
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

const fetchRateLimitSchema = z.object({
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

const fetchRetrySchema = z.object({
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
});

const fetchProviderConfigSchema = z.object({
  type: z
    .string()
    .describe(
      "Fetch adapter identifier such as serper, diffbot, firecrawl, or jina.",
    ),
  baseUrl: z.string().describe("Provider base URL for this adapter."),
  authentication: fetchAuthenticationSchema.describe(
    "Provider credentials or Hermes variable placeholders.",
  ),
  headers: z
    .record(z.string())
    .optional()
    .describe("Extra HTTP headers merged into every request."),
  rateLimit: fetchRateLimitSchema.describe(
    "Sliding-window request budget for this fetch provider.",
  ),
  concurrency: z.number().int().min(1).max(16).default(2).optional(),
  timeoutMs: z.number().int().positive().default(30_000).optional(),
  retry: fetchRetrySchema.default(fetchDefaultRetry).optional(),
});

const defaultSerperFetchProvider = {
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

const defaultDiffbotFetchProvider = {
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

const defaultFetchProviders = [
  defaultSerperFetchProvider,
  defaultDiffbotFetchProvider,
] as const;

const fetchSchema = z
  .object({
    providers: z
      .array(fetchProviderConfigSchema)
      .min(1)
      .default([...defaultFetchProviders])
      .describe(
        "Ordered fetch-provider chain. The first provider is tried for each URL; later providers run only after earlier failures.",
      ),
  })
  .default({})
  .describe("Ordered web-fetch provider chain for the on-demand fetch pass.");

const deadUrlCacheSchema = z
  .object({
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
  })
  .default({})
  .describe("Negative cache for URLs that repeatedly fail to fetch.");

const hostErrorBreakerSchema = z
  .object({
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
      .describe(
        "Minimum fetch attempts on a host before the breaker can trip.",
      ),
    errorRateThreshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("Host error rate above which further fetches are skipped."),
  })
  .default({})
  .describe("Per-host circuit breaker based on fetch error rate.");

const resilienceSchema = z
  .object({
    deadUrlCache: deadUrlCacheSchema,
    hostErrorBreaker: hostErrorBreakerSchema,
  })
  .default({})
  .describe("Failure-avoidance controls applied before and during fetch.");

/**
 * Runtime config for the content-generation agent, supplied by Hermes on each
 * invocation. Only the model block and the duplicate-guard timezone are
 * operator-tunable; all other behavior is hardcoded in
 * {@link CONTENT_GENERATION_CONSTANTS}.
 *
 * Unknown keys are stripped (no `.strict()`) so a stored config that still
 * carries the old groups continues to validate during rollout.
 */
export const ContentGenerationConfigSchema = z.object({
  model: modelSchema,
  duplicateGuard: duplicateGuardSchema,
  fetch: fetchSchema,
  resilience: resilienceSchema,
  maxFetchesPerRun: z
    .number()
    .int()
    .positive()
    .default(18)
    .describe(
      "Maximum on-demand fetches per generation run. Sized to cover the section-coverage seeds (one per publishable section) plus triage requests. When requests exceed the budget, the overflow is prioritized by sectionScore descending and the rest proceed on description alone.",
    ),
});

/** Parsed invoke config with all group and field defaults applied. */
export type ContentGenerationConfig = z.output<
  typeof ContentGenerationConfigSchema
>;

/**
 * Hardcoded behavior for the content-generation agent. These values used to be
 * exposed as config groups; they are now fixed constants so the agent has a
 * single, predictable pipeline.
 */
export const CONTENT_GENERATION_CONSTANTS = {
  /** Maximum number of articles fed into the prompt, across all sections. */
  topNewsCount: 30,
  /** Maximum articles taken from any one section, so a dense section cannot crowd out the rest. */
  topNewsPerSection: 8,
  /** Per-request timeout in milliseconds for LLM calls. */
  requestTimeoutMs: 120_000,
  /** Source truncation budgets for the LLM context window. */
  truncation: {
    maxCharsPerSource: 8000,
    maxTotalContextChars: 200_000,
  },
  /** Retry policy for LLM calls (exponential backoff with jitter). */
  retry: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 8000,
    jitter: true,
  },
  /** Always-on citation grounding safety thresholds. */
  citationGrounding: {
    policy: "unlink",
    minOverlapScore: 0.18,
    numericBonus: 0.2,
  },
  /** Always-on require-citation pruning defaults (match prior behavior). */
  requireCitation: {
    sections: [
      "industryPulse",
      "competitiveLandscape",
      "dealsAndMovements",
      "regulatoryPolicyWatch",
      "disruptorsOrTech",
      "quickHits",
    ] as NewsletterSectionId[],
    dedupeArticlesWithinSection: true,
    dedupeScope: "newsletter",
    withinRunDedupSimilarity: 0.55,
    withinRunTitleDedupSimilarity: 0.5,
  },
  /**
   * Minimum section-fit score for an article assigned to a structured section to survive being
   * placed in Quick Hits. Keeps weakly-relevant items from being demoted into Quick Hits as filler.
   */
  quickHitsDemotionMinScore: 0.7,
  /**
   * Cross-section same-event dedup: drop a bullet whose distinctive entity/number anchors overlap an
   * event already shipped in a higher-priority section, catching the same story worded differently
   * that lexical title/text dedup misses. Runs after within-run dedup on the resolved newsletter.
   */
  eventDedup: {
    /** Kill switch: when false, no cross-section event dedup runs. */
    enabled: true,
    /** Minimum shared anchors before two bullets are treated as the same event. */
    minSharedAnchors: 4,
    /** Minimum anchor containment (`shared / smaller set`) alongside the shared-count guard. */
    minContainment: 0.4,
  },
  /**
   * Cross-day (cross-run) dedup so consecutive newsletters do not repeat points.
   * Hardcoded (not Hermes config) to match the rest of this agent's pipeline.
   */
  crossRunDedup: {
    /** Kill switch: when false, no recent-bullet fetch, prompt block, or drop pass runs. */
    enabled: true,
    /** Lookback in calendar days for the recent-bullet corpus. */
    windowDays: 14,
    /** Jaccard threshold for the post-generation drop; matches within-run dedup. */
    similarity: 0.55,
    /** Max recent bullets injected into the "avoid repeating" prompt block. */
    promptBulletLimit: 20,
  },
} as const;

/**
 * Content-generation config after defaults are applied. The agent reads the
 * model block from here and everything else from
 * {@link CONTENT_GENERATION_CONSTANTS}.
 */
export type ResolvedContentGenerationConfig = ContentGenerationConfig;

/**
 * Merges Hermes-supplied config with defaults.
 *
 * @param config - Raw Hermes agent config.
 * @returns Config safe to use at runtime.
 */
export function resolveContentGenerationConfig(
  config: unknown,
): ResolvedContentGenerationConfig {
  return ContentGenerationConfigSchema.parse(config);
}
