import { z } from "zod";

import { findUnknownLlmPromptPlaceholderTokens } from "@workspace/agent-llm-prompt-template";
import { reasoningEffortSchema } from "@workspace/agent-runtime";
import { NEWSLETTER_SECTION_IDS } from "@workspace/agent-data-api-contract";
import type { NewsletterSectionId } from "@workspace/agent-data-api-contract";

/** Maximum length for each optional `prompts.*` string (Hermes JSON config). */
export const CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH = 50_000;

/** Rejects runaway `maxAttempts` overrides that would hammer upstream APIs. */
export const CONTENT_GENERATION_RETRY_MAX_ATTEMPTS_CEILING = 10;

const contentGenerationSystemPromptPlaceholders = new Set([
  "topNewsCount",
  "tickerId",
  "tickerName",
  "tickerSymbol",
]);

const contentGenerationUserPromptPlaceholders = new Set([
  "sourceSummaries",
  "tickerId",
  "tickerName",
  "tickerSymbol",
  "date",
  "topNewsCount",
]);

const sourceRankingWeightsSchema = z
  .object({
    relevance: z
      .number()
      .min(0)
      .max(1)
      .default(0.45)
      .describe("Weight for relevance score in the composite ranking."),
    recency: z
      .number()
      .min(0)
      .max(1)
      .default(0.25)
      .describe("Weight for recency decay in the composite ranking."),
    tier: z
      .number()
      .min(0)
      .max(1)
      .default(0.2)
      .describe("Weight for publisher tier in the composite ranking."),
    length: z
      .number()
      .min(0)
      .max(1)
      .default(0.1)
      .describe("Weight for article length in the composite ranking."),
  })
  .default({})
  .describe("Composite score weights (should sum to 1.0).");

const sourceRankingSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, rank and diversify sources before the structured LLM pass.",
      ),
    maxPerHost: z
      .number()
      .int()
      .positive()
      .default(2)
      .describe("Maximum articles from the same host in the final prompt."),
    recencyHalfLifeHours: z
      .number()
      .positive()
      .default(36)
      .describe("Recency decay half-life in hours for the composite score."),
    weights: sourceRankingWeightsSchema,
  })
  .default({})
  .describe("Pre-LLM source ranking and host diversification.");

const fewShotSectorTagSchema = z.enum([
  "industrial",
  "consumer",
  "financial",
  "tech",
  "commodities",
]);

const fewShotSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, inject curated newsletter exemplars before source summaries.",
      ),
    maxExemplars: z
      .number()
      .int()
      .min(1)
      .max(2)
      .default(1)
      .describe(
        "Maximum exemplars to include in the user prompt (1–2; more causes over-imitation).",
      ),
    sectorTag: fewShotSectorTagSchema
      .optional()
      .describe(
        "When set, always use exemplars for this sector instead of keyword selection.",
      ),
  })
  .default({})
  .describe("Few-shot exemplar anchors for format and voice calibration.");

const contextSchema = z
  .object({
    maxCharsPerSource: z
      .number()
      .int()
      .positive()
      .default(8000)
      .describe("Maximum characters to keep per source before truncation."),
    maxTotalContextChars: z
      .number()
      .int()
      .positive()
      .default(100_000)
      .describe("Maximum total characters across all sources in the prompt."),
  })
  .default({})
  .describe("Source truncation budgets for the LLM context window.");

const numericAnchorsSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, extract verbatim figures for the prompt and audit the briefing.",
      ),
    perArticleCap: z
      .number()
      .int()
      .positive()
      .default(5)
      .describe("Maximum anchors per article in the prompt sidecar."),
    totalCap: z
      .number()
      .int()
      .positive()
      .default(25)
      .describe("Maximum anchors overall in the prompt sidecar."),
    unmatchedPolicy: z
      .enum(["warn", "strip"])
      .default("warn")
      .describe(
        "warn = log only; strip = replace figures missing from sources.",
      ),
  })
  .default({})
  .describe("Verbatim numeric anchor extraction and coverage audit.");

const inputsSchema = z
  .object({
    sourceRanking: sourceRankingSchema,
    context: contextSchema,
    fewShot: fewShotSchema,
    numericAnchors: numericAnchorsSchema,
  })
  .default({})
  .describe(
    "Prompt-shaping inputs: source selection, truncation, exemplars, and figures.",
  );

const brainstormSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, run a free-form editor's memo pass before structured JSON generation.",
      ),
    model: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Chat model for the brainstorm pass. If omitted, uses credentials.chatModel.",
      ),
    reasoningEffort: reasoningEffortSchema
      .optional()
      .describe(
        "Overrides credentials.reasoningEffort for the brainstorm pass.",
      ),
    maxOutputTokens: z
      .number()
      .int()
      .positive()
      .default(700)
      .describe("Max output tokens for the brainstorm generateText call."),
  })
  .default({})
  .describe("Two-pass generation: free-form memo before structured JSON.");

const creativitySchema = z
  .object({
    brainstorm: brainstormSchema,
  })
  .default({})
  .describe("Creative widening passes before structured generation.");

const selfCritiqueSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, run a bounded self-critique pass before polish and grounding.",
      ),
    dropFraction: z
      .number()
      .min(0)
      .max(0.4)
      .default(0.2)
      .describe(
        "Maximum fraction of bullets that may be rewritten or dropped.",
      ),
    minBulletCount: z
      .number()
      .int()
      .nonnegative()
      .default(8)
      .describe(
        "Skip critique when the briefing has fewer than this many bullets.",
      ),
    critiqueModel: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Chat model for the critique pass. If omitted, uses credentials.chatModel.",
      ),
    reasoningEffort: reasoningEffortSchema
      .optional()
      .describe(
        "Overrides credentials.reasoningEffort for the self-critique pass.",
      ),
    critiqueMaxOutputTokens: z
      .number()
      .int()
      .positive()
      .default(1500)
      .describe("Max output tokens for the critique generateObject call."),
    preferRewriteOverDrop: z
      .boolean()
      .default(true)
      .describe(
        "Prefer suggestedRewrite over dropping a bullet when both apply.",
      ),
  })
  .default({})
  .describe("Bounded self-critique pass to repair the weakest bullets.");

const citationGroundingSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, verify each articleIndex against source overlap after generation.",
      ),
    policy: z
      .enum(["warn", "unlink", "drop"])
      .default("unlink")
      .describe(
        "warn = log only; unlink = strip bad links; drop = remove rows (with schema floors).",
      ),
    minOverlapScore: z
      .number()
      .min(0)
      .max(1)
      .default(0.18)
      .describe("Minimum Jaccard overlap required to keep a citation link."),
    numericBonus: z
      .number()
      .min(0)
      .max(0.5)
      .default(0.2)
      .describe(
        "Bonus added when bullet numbers appear in the cited article body.",
      ),
  })
  .default({})
  .describe("Post-generation citation overlap verification.");

const polishSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, run deterministic filler/hedge/register polish before grounding.",
      ),
    tier: z
      .enum(["safe", "aggressive"])
      .default("safe")
      .describe(
        "safe = filler, hedge, register; aggressive adds overused-word replacement.",
      ),
    disabledRuleIds: z
      .array(z.string())
      .default([])
      .describe("Rule ids to skip without disabling the whole pass."),
  })
  .default({})
  .describe("Deterministic vocabulary and register cleanup.");

const crossRunDedupSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, inject recent-bullet avoidance and post-walk dedup.",
      ),
    windowDays: z
      .number()
      .int()
      .positive()
      .default(14)
      .describe("Lookback window in days for the recent bullet corpus."),
    minSimilarity: z
      .number()
      .min(0)
      .max(1)
      .default(0.55)
      .describe("Minimum Jaccard similarity to flag a near-duplicate."),
    policy: z
      .enum(["warn", "mark", "drop"])
      .default("warn")
      .describe(
        "warn = log only; mark = prepend [follow-up]; drop = remove rows.",
      ),
    lowInfoDayThreshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe(
        "Fraction of near-duplicate bullets that sets lowInformationDay.",
      ),
  })
  .default({})
  .describe("Cross-run semantic dedup against recent newsletter bullets.");

const requireCitationSectionEnum = z.enum(
  NEWSLETTER_SECTION_IDS as [NewsletterSectionId, ...NewsletterSectionId[]],
);

const requireCitationSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, run the require-citation pruning pass as the final transform.",
      ),
    sections: z
      .array(requireCitationSectionEnum)
      .default([
        "industryPulse",
        "competitiveLandscape",
        "dealsAndMovements",
        "regulatoryPolicyWatch",
        "disruptorsOrTech",
        "quickHits",
      ])
      .describe(
        "Which sections to apply pruning to. industry-pulse is kept only when it resolves a citation.",
      ),
    dedupeArticlesWithinSection: z
      .boolean()
      .default(true)
      .describe(
        "When true, keep only the first row for a given article URL within the dedup scope.",
      ),
    dedupeScope: z
      .enum(["section", "newsletter"])
      .default("newsletter")
      .describe(
        "section = dedup URLs per section only; newsletter = dedup URLs across all sections.",
      ),
    withinRunDedupSimilarity: z
      .number()
      .min(0)
      .max(1)
      .default(0.55)
      .describe(
        "Jaccard similarity threshold for within-run semantic dedup of resolved newsletter items.",
      ),
  })
  .default({})
  .describe(
    "Final pruning pass: drops uncited rows, enforces one article per bullet, removes empty sections.",
  );

const competitiveFocusSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, run the competitive-focus gate after polish to drop or flag issuer-only bullets.",
      ),
    policy: z
      .enum(["warn", "flag", "drop"])
      .default("drop")
      .describe(
        "warn = log only; flag = prepend [ISSUER-ONLY] marker; drop = remove the bullet (product intent).",
      ),
    maxCompetitorsInPrompt: z
      .number()
      .int()
      .positive()
      .default(6)
      .describe(
        "Maximum named competitors to include in the user prompt directive.",
      ),
  })
  .default({})
  .describe(
    "Competitor-anchored Competitive Landscape gate: drops bullets that describe the issuer with no rival in sight.",
  );

const qualitySchema = z
  .object({
    selfCritique: selfCritiqueSchema,
    citationGrounding: citationGroundingSchema,
    polish: polishSchema,
    crossRunDedup: crossRunDedupSchema,
    requireCitation: requireCitationSchema,
    competitiveFocus: competitiveFocusSchema,
  })
  .default({})
  .describe("Post-generation repair, verification, polish, and dedup passes.");

const subjectLineSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, generate and score subject-line candidates after structured generation.",
      ),
    candidateCount: z
      .number()
      .int()
      .min(3)
      .max(8)
      .default(5)
      .describe(
        "Number of alternative subjects to request from the sidecar LLM call.",
      ),
    model: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Chat model for subject candidates. If omitted, uses credentials.chatModel.",
      ),
    reasoningEffort: reasoningEffortSchema
      .optional()
      .describe(
        "Overrides credentials.reasoningEffort for the subject-line pass.",
      ),
    weights: z
      .object({
        lengthFit: z
          .number()
          .min(0)
          .max(1)
          .default(0.2)
          .describe("Weight for subject length fit scoring."),
        tickerPresence: z
          .number()
          .min(0)
          .max(1)
          .default(0.15)
          .describe("Weight for ticker presence in the subject."),
        curiosityGap: z
          .number()
          .min(0)
          .max(1)
          .default(0.25)
          .describe("Weight for curiosity-gap phrasing."),
        novelty: z
          .number()
          .min(0)
          .max(1)
          .default(0.2)
          .describe("Weight for novelty vs recent subjects."),
        readability: z
          .number()
          .min(0)
          .max(1)
          .default(0.2)
          .describe("Weight for readability scoring."),
      })
      .default({})
      .describe("Scoring weights for subject-line candidate ranking."),
  })
  .default({})
  .describe("Subject-line candidate generation and scoring.");

const deliverySchema = z
  .object({
    subjectLine: subjectLineSchema,
  })
  .default({})
  .describe("Delivery-oriented output tuning (subject line, preheader).");

const credentialsSchema = z
  .object({
    openaiApiKey: z
      .string()
      .min(1, "credentials.openaiApiKey is required")
      .default("{{OPENAI_API_KEY}}")
      .refine((k) => k.trim().length > 0, {
        message: "credentials.openaiApiKey cannot be whitespace only",
      })
      .describe(
        "OpenAI API key or a Hermes variable placeholder such as {{OPENAI_API_KEY}}.",
      ),
    baseUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "Base URL for the OpenAI-compatible HTTP API (e.g. Azure OpenAI or a proxy).",
      ),
    chatModel: z
      .string()
      .min(1)
      .default("{{OPENAI_MODEL}}")
      .describe(
        "Chat model id (e.g. gpt-4o-mini) or a Hermes variable placeholder such as {{OPENAI_MODEL}}.",
      ),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum tokens to generate per LLM call."),
    reasoningEffort: reasoningEffortSchema
      .optional()
      .describe(
        "Reasoning effort for LLM passes when the model supports it (gpt-5/o-series). Leave unset for non-reasoning models like gpt-4o-mini.",
      ),
    timeoutMs: z
      .number()
      .int()
      .positive()
      .default(120_000)
      .describe("Per-request timeout in milliseconds for LLM calls."),
  })
  .default({})
  .describe("OpenAI credentials resolved from Hermes Variables.");

const outputSchema = z
  .object({
    topNewsCount: z
      .number()
      .int()
      .positive()
      .default(10)
      .describe("Number of top news items to include in the output."),
  })
  .default({})
  .describe("Newsletter output sizing.");

const promptsSchema = z
  .object({
    systemPrompt: z
      .string()
      .max(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH, {
        message: `prompts.systemPrompt must be at most ${String(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
      })
      .optional()
      .describe(
        "System prompt template. Placeholders: {{topNewsCount}}, {{tickerId}}, {{tickerName}}, {{tickerSymbol}}. Do not put secrets here.",
      ),
    userPromptTemplate: z
      .string()
      .max(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH, {
        message: `prompts.userPromptTemplate must be at most ${String(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
      })
      .optional()
      .describe(
        "User prompt template. Placeholders: {{sourceSummaries}}, {{tickerId}}, {{tickerName}}, {{tickerSymbol}}, {{date}}, {{topNewsCount}}. Do not put secrets here.",
      ),
  })
  .default({})
  .describe("Optional LLM prompt template overrides.");

const llmRetrySchema = z
  .object({
    maxAttempts: z
      .number()
      .int()
      .nonnegative()
      .default(3)
      .describe("Maximum total LLM attempts (including the first)."),
    baseDelayMs: z
      .number()
      .int()
      .nonnegative()
      .default(500)
      .describe("Base delay in milliseconds before the first retry."),
    maxDelayMs: z
      .number()
      .int()
      .nonnegative()
      .default(8000)
      .describe("Maximum backoff delay cap in milliseconds."),
    jitter: z
      .boolean()
      .default(true)
      .describe("When true, applies ±50% random jitter to each backoff delay."),
  })
  .default({})
  .describe("Retry policy for LLM calls (429/500 backoff).");

const persistRetrySchema = z
  .object({
    maxAttempts: z
      .number()
      .int()
      .nonnegative()
      .default(2)
      .describe("Maximum retry attempts for persisting data."),
    baseDelayMs: z
      .number()
      .int()
      .nonnegative()
      .default(200)
      .describe("Base delay in milliseconds between persist retries."),
    maxDelayMs: z
      .number()
      .int()
      .nonnegative()
      .default(2000)
      .describe("Maximum delay cap in milliseconds between persist retries."),
  })
  .default({})
  .describe("Retry policy for agent-data-api persist calls (no jitter).");

const reliabilitySchema = z
  .object({
    llmRetry: llmRetrySchema,
    persistRetry: persistRetrySchema,
  })
  .default({})
  .describe("Retry and backoff settings for LLM and persist operations.");

const freshnessSchema = z
  .object({
    strategy: z
      .literal("calendar_day")
      .default("calendar_day")
      .describe("Strategy for determining newsletter freshness."),
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
        "IANA timezone for freshness calculations (e.g. Asia/Jakarta).",
      ),
  })
  .default({
    strategy: "calendar_day",
    timezone: "Asia/Jakarta",
  })
  .describe("Skip-if-fresh precheck window (calendar day in timezone).");

/**
 * Runtime config for the content-generation agent, supplied by Hermes on each invocation
 * (from the admin-selected agent config for the pipeline step).
 */
export const ContentGenerationConfigSchema = z
  .object({
    credentials: credentialsSchema,
    output: outputSchema,
    prompts: promptsSchema,
    inputs: inputsSchema,
    creativity: creativitySchema,
    quality: qualitySchema,
    delivery: deliverySchema,
    freshness: freshnessSchema,
    reliability: reliabilitySchema,
  })
  /** Reject unknown keys (e.g. legacy flat `openai`, `sourceRanking`) so configs fail fast. */
  .strict()
  .superRefine((data, ctx) => {
    const prompts = data.prompts;
    if (prompts.systemPrompt) {
      for (const token of findUnknownLlmPromptPlaceholderTokens(
        prompts.systemPrompt,
        contentGenerationSystemPromptPlaceholders,
      )) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown placeholder {{${token}}} in prompts.systemPrompt`,
          path: ["prompts", "systemPrompt"],
        });
      }
    }
    if (prompts.userPromptTemplate) {
      for (const token of findUnknownLlmPromptPlaceholderTokens(
        prompts.userPromptTemplate,
        contentGenerationUserPromptPlaceholders,
      )) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown placeholder {{${token}}} in prompts.userPromptTemplate`,
          path: ["prompts", "userPromptTemplate"],
        });
      }
    }

    refineRetryGroupValidity(
      data.reliability.llmRetry,
      ["reliability", "llmRetry"],
      ctx,
    );
    refineRetryGroupValidity(
      data.reliability.persistRetry,
      ["reliability", "persistRetry"],
      ctx,
    );
  });

/** Parsed invoke config with all group and field defaults applied. */
export type ContentGenerationConfig = z.output<
  typeof ContentGenerationConfigSchema
>;

/** Fully resolved LLM retry settings (all fields guaranteed to be present). */
export type ResolvedLlmRetryConfig =
  ContentGenerationConfig["reliability"]["llmRetry"];

/** Fully resolved persistence retry settings. */
export type ResolvedPersistRetryConfig =
  ContentGenerationConfig["reliability"]["persistRetry"];

/**
 * Content-generation config with per-pass model ids and reasoning effort levels
 * resolved. Use {@link resolveContentGenerationConfig} to obtain this from a parsed config.
 *
 * Per-pass reasoning effort falls back to `credentials.reasoningEffort` when the
 * pass-level override is unset. All values may be `undefined` when the operator has
 * not set reasoning effort — this is safe for non-reasoning models.
 */
export type ResolvedContentGenerationConfig = ContentGenerationConfig & {
  brainstormModel: string;
  critiqueModel: string;
  subjectLineModel: string;
  structuredReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
  brainstormReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
  critiqueReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
  subjectLineReasoningEffort?: import("@workspace/agent-runtime").OpenAiReasoningEffort;
};

type RetryFields = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

/**
 * Rejects structurally broken retry overrides (inverted delay cap or runaway attempts).
 *
 * @param retry - Parsed retry group from Hermes config.
 * @param pathPrefix - Zod issue path prefix under `reliability`.
 * @param ctx - Zod refinement context.
 */
function refineRetryGroupValidity(
  retry: RetryFields,
  pathPrefix: readonly ["reliability", "llmRetry" | "persistRetry"],
  ctx: z.RefinementCtx,
): void {
  if (retry.maxDelayMs < retry.baseDelayMs) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${pathPrefix[1]}.maxDelayMs (${String(retry.maxDelayMs)}) must be >= ${pathPrefix[1]}.baseDelayMs (${String(retry.baseDelayMs)})`,
      path: [...pathPrefix, "maxDelayMs"],
    });
  }

  if (retry.maxAttempts > CONTENT_GENERATION_RETRY_MAX_ATTEMPTS_CEILING) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${pathPrefix[1]}.maxAttempts must be at most ${String(CONTENT_GENERATION_RETRY_MAX_ATTEMPTS_CEILING)}`,
      path: [...pathPrefix, "maxAttempts"],
    });
  }
}

/**
 * Merges Hermes-supplied config with production defaults and resolves optional
 * per-pass model ids to `credentials.chatModel`.
 *
 * @param config - Raw Hermes agent config.
 * @returns Config safe to use at runtime.
 */
export function resolveContentGenerationConfig(
  config: unknown,
): ResolvedContentGenerationConfig {
  const parsed = ContentGenerationConfigSchema.parse(config);
  const chatModel = parsed.credentials.chatModel;
  const defaultEffort = parsed.credentials.reasoningEffort;

  return {
    ...parsed,
    brainstormModel: parsed.creativity.brainstorm.model ?? chatModel,
    critiqueModel: parsed.quality.selfCritique.critiqueModel ?? chatModel,
    subjectLineModel: parsed.delivery.subjectLine.model ?? chatModel,
    ...(defaultEffort !== undefined
      ? { structuredReasoningEffort: defaultEffort }
      : {}),
    ...(parsed.creativity.brainstorm.reasoningEffort !== undefined
      ? {
          brainstormReasoningEffort:
            parsed.creativity.brainstorm.reasoningEffort,
        }
      : defaultEffort !== undefined
        ? { brainstormReasoningEffort: defaultEffort }
        : {}),
    ...(parsed.quality.selfCritique.reasoningEffort !== undefined
      ? { critiqueReasoningEffort: parsed.quality.selfCritique.reasoningEffort }
      : defaultEffort !== undefined
        ? { critiqueReasoningEffort: defaultEffort }
        : {}),
    ...(parsed.delivery.subjectLine.reasoningEffort !== undefined
      ? {
          subjectLineReasoningEffort:
            parsed.delivery.subjectLine.reasoningEffort,
        }
      : defaultEffort !== undefined
        ? { subjectLineReasoningEffort: defaultEffort }
        : {}),
  };
}
