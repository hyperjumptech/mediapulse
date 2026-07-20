import { z } from "zod";

import { fetchProviderEntrySchema } from "@workspace/agent-ingestion";

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

const defaultSerperFetchProvider = {
  provider: "serper" as const,
  apiKey: "{{SERPER_API_KEY}}",
};

const defaultDiffbotFetchProvider = {
  provider: "diffbot" as const,
  apiKey: "{{DIFFBOT_API_KEY}}",
};

const defaultFetchProviders = [
  defaultSerperFetchProvider,
  defaultDiffbotFetchProvider,
] as const;

const fetchSchema = z
  .object({
    providers: z
      .array(fetchProviderEntrySchema)
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
  /**
   * Sections guaranteed a fetched body for their top candidate, so a section is never dropped
   * merely because on-demand triage skipped its highest-scored article.
   */
  coverageSeedSections: [
    "industryPulse",
    "competitiveLandscape",
    "dealsAndMovements",
    "regulatoryPolicyWatch",
    "disruptorsOrTech",
    "quickHits",
  ] as NewsletterSectionId[],
  /**
   * Cross-section same-event dedup: drop a candidate whose distinctive entity/number anchors
   * overlap an event another candidate already covers from a higher-priority placement. Runs on
   * candidate sources before any LLM call.
   */
  eventDedup: {
    /** Kill switch: when false, no cross-section event dedup runs. */
    enabled: true,
    /** Minimum shared anchors before two candidates are treated as the same event. */
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
    /** Score above which a candidate source is treated as a story a recent bullet already told. */
    similarity: 0.55,
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
