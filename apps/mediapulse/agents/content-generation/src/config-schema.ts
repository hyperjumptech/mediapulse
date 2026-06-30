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
  /** Number of top news articles to feed into the prompt. */
  topNewsCount: 30,
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
