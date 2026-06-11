import { ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import type { RelevanceWeightMapV1 } from "./analysis-relevance-scoring.js";

const extractionExemplarArchetypeSchema = z.enum([
  "earnings",
  "legal",
  "leadership",
  "product",
]);

const credentialsSchema = z
  .object({
    openaiApiKey: z
      .string()
      .min(1)
      .default("{{OPENAI_API_KEY}}")
      .describe(
        "OpenAI API key or a Hermes variable placeholder such as {{OPENAI_API_KEY}}.",
      ),
    openaiModel: z
      .string()
      .min(1)
      .default("{{OPENAI_MODEL}}")
      .describe(
        "Chat model id (e.g. gpt-4o-mini) or a Hermes variable placeholder such as {{OPENAI_MODEL}}.",
      ),
  })
  .default({})
  .describe("OpenAI credentials resolved from Hermes Variables.");

const extractionSchema = z
  .object({
    maxContentChars: z
      .number()
      .int()
      .positive()
      .default(12_000)
      .describe(
        "Truncate article text in the LLM user message (full text remains in DB).",
      ),
    useStructureAwareTruncation: z
      .boolean()
      .default(false)
      .describe(
        "When true, use structure-aware paragraph truncation instead of naive slice.",
      ),
    truncationLeadParagraphsAlwaysKept: z
      .number()
      .int()
      .min(0)
      .max(8)
      .default(2)
      .describe("Lead paragraphs always kept before score-ranked allocation."),
    truncationFinancialKeywordsExtra: z
      .array(z.string())
      .default([])
      .describe(
        "Operator-extensible financial keywords for truncation scoring.",
      ),
    fewShotExemplarCount: z
      .number()
      .int()
      .min(0)
      .max(4)
      .default(0)
      .describe(
        "Number of few-shot extraction exemplars to inject (0 disables).",
      ),
    fewShotExemplarArchetypes: z
      .array(extractionExemplarArchetypeSchema)
      .optional()
      .describe(
        "When set, only these archetypes are eligible for few-shot selection.",
      ),
    useBrainstormPass: z
      .boolean()
      .default(false)
      .describe(
        "When true, run a free-form brainstorm pass before structured extraction.",
      ),
    brainstormModel: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Chat model for the brainstorm pass. If omitted, uses credentials.openaiModel.",
      ),
    concurrency: z
      .number()
      .int()
      .min(1)
      .max(16)
      .default(1)
      .describe(
        "Max concurrent per-source extractions (1 = sequential; opt-in parallelism).",
      ),
    transientRetries: z
      .number()
      .int()
      .min(0)
      .max(5)
      .default(2)
      .describe(
        "Retries after the first LLM extraction attempt when a transient error is classified. 0 disables retries.",
      ),
    transientRetryBaseDelayMs: z
      .number()
      .int()
      .positive()
      .default(500)
      .describe(
        "Initial backoff in ms for extraction retries (full-jitter exponential).",
      ),
    transientRetryMaxDelayMs: z
      .number()
      .int()
      .positive()
      .default(8_000)
      .describe("Cap on jittered backoff in ms for extraction retries."),
    callTimeoutMs: z
      .number()
      .int()
      .positive()
      .default(60_000)
      .describe(
        "Per-call wall-clock timeout in ms applied to each generateObject/generateText attempt. A stuck call aborts after this interval and is retried.",
      ),
  })
  .default({})
  .describe("LLM extraction settings.");

const qualitySchema = z
  .object({
    useRelationSelfCritique: z
      .boolean()
      .default(false)
      .describe(
        "When true, run a second LLM pass to critique and prune noisy relation triples.",
      ),
    critiqueDropFraction: z
      .number()
      .min(0)
      .max(0.5)
      .default(0.25)
      .describe(
        "Max fraction of relations per source that critique may drop (hard cap).",
      ),
    critiqueMinRelationCount: z
      .number()
      .int()
      .nonnegative()
      .default(3)
      .describe(
        "Skip critique when a source has fewer relations than this threshold.",
      ),
    critiqueModel: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Chat model for relation critique. If omitted, uses credentials.openaiModel.",
      ),
    vocabularyPolicy: z
      .enum(["strict", "partition", "repair"])
      .default("strict")
      .describe(
        "How to handle vocabulary-invalid extraction rows. `strict` skips the whole source (legacy). `partition` drops bad rows. `repair` partitions then re-labels bad rows once.",
      ),
    repairModel: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Chat model for vocabulary repair. If omitted, uses credentials.openaiModel.",
      ),
    repairMaxItems: z
      .number()
      .int()
      .positive()
      .default(20)
      .describe(
        "Skip repair when rejected row count exceeds this cap (likely systemic vocabulary drift).",
      ),
    groundingPolicy: z
      .enum(["drop", "flag", "off"])
      .default("off")
      .describe("Post-extraction grounding policy for hallucinated entities."),
    groundingMinTitleHits: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe(
        "When greater than zero, entity must appear in the title to count as grounded.",
      ),
  })
  .default({})
  .describe(
    "Post-extraction quality passes: relation critique, vocabulary repair, and entity grounding.",
  );

const limitsSchema = z
  .object({
    entitiesPerArticle: z
      .number()
      .int()
      .positive()
      .default(20)
      .describe("Max entities extracted per source."),
    relationsPerArticle: z
      .number()
      .int()
      .positive()
      .default(20)
      .describe("Max relations extracted per source."),
    entitiesPerRun: z
      .number()
      .int()
      .positive()
      .default(200)
      .describe("Max entities accumulated across the run."),
    relationsPerRun: z
      .number()
      .int()
      .positive()
      .default(200)
      .describe("Max relations accumulated across the run."),
    articleEntitiesPerArticle: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe(
        "Max articleEntities rows per source after LLM extract (before run merge).",
      ),
    articleEntitiesPerRun: z
      .number()
      .int()
      .positive()
      .default(500)
      .describe(
        "Max articleEntities rows for the run after dedupe (before POST).",
      ),
  })
  .default({})
  .describe("Entity and relation output caps per article and per run.");

const postingSchema = z
  .object({
    chunkRelationBatchSize: z
      .number()
      .int()
      .positive()
      .default(25)
      .describe(
        "Max relations per POST chunk (FR9); entity closure is added per chunk.",
      ),
    chunkArticleEntityBatchSize: z
      .number()
      .int()
      .positive()
      .default(50)
      .describe("Max articleEntities rows per POST chunk."),
    chunkArticleRelevanceBatchSize: z
      .number()
      .int()
      .positive()
      .default(40)
      .describe("Max articleRelevances rows per POST chunk."),
    transientRetries: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe(
        "Retries after the first attempt for analysis.create when the API returns 429 or 5xx.",
      ),
    transientRetryBaseDelayMs: z
      .number()
      .int()
      .positive()
      .default(500)
      .describe(
        "Initial backoff in ms; delay doubles each retry (base * 2^attempt).",
      ),
  })
  .default({})
  .describe("Chunked POST settings and retry policy.");

const scoringSchema = z
  .object({
    breakdownVersion: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe(
        "Stored in scoreBreakdown._version (must match Hermes when bumping breakdown schema).",
      ),
    weightBreakingNews: z
      .number()
      .nonnegative()
      .default(0.2)
      .describe("Relevance weight for breaking-news signal."),
    weightKgRelation: z
      .number()
      .nonnegative()
      .default(0.3)
      .describe("Relevance weight for KG relation signal."),
    weightFundamental: z
      .number()
      .nonnegative()
      .default(0.05)
      .describe("Relevance weight for fundamental signal."),
    weightTickerSalience: z
      .number()
      .nonnegative()
      .default(0.2)
      .describe("Relevance weight for ticker-salience signal."),
    weightSourceQuality: z
      .number()
      .nonnegative()
      .default(0.25)
      .describe("Relevance weight for source-quality signal."),
    useSourceQualityV2: z
      .boolean()
      .default(false)
      .describe(
        "When true, compute real sourceQuality from host tier, recency, and structural cues.",
      ),
    sourceQualityRecencyHalfLifeHours: z
      .number()
      .positive()
      .default(72)
      .describe(
        "Recency half-life (hours) for source-quality exponential decay.",
      ),
    hostTier1: z
      .array(z.string())
      .optional()
      .describe("Replaces default tier-1 host suffix list when set."),
    hostTier2: z
      .array(z.string())
      .optional()
      .describe("Replaces default tier-2 host suffix list when set."),
    hostTier3: z
      .array(z.string())
      .optional()
      .describe("Replaces default tier-3 host suffix list when set."),
  })
  .default({})
  .describe("Relevance scoring weights and source quality settings.");

const selectionSchema = z
  .object({
    useDiversification: z
      .boolean()
      .default(false)
      .describe(
        "When true, diversify selected rows by entity/title event clusters.",
      ),
    entityOverlapThreshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe(
        "Jaccard threshold for merging rows by shared entity names (default 0.5).",
      ),
    titleSimilarityThreshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.4)
      .describe(
        "Jaccard threshold for merging rows by title 4-gram overlap (default 0.4).",
      ),
    minScore: z
      .number()
      .min(0)
      .max(1)
      .default(0.35)
      .describe("Minimum score to be eligible for selected: true."),
    maxPerTickerPerDay: z
      .number()
      .int()
      .nonnegative()
      .default(10)
      .describe(
        "Cap on additional selected rows per UTC day (budget minus GET selectedCountToday).",
      ),
  })
  .default({})
  .describe("Article selection criteria for relevance scoring.");

const batchSchema = z
  .object({
    maxSources: z
      .number()
      .int()
      .positive()
      .default(10)
      .describe(
        "Cap on data sources loaded and processed per run. Override in Hermes agent config.",
      ),
    getDataSourceLimitMax: z
      .number()
      .int()
      .positive()
      .max(ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX)
      .default(ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX)
      .describe(
        "Max analysis.get limit. Actual limit is min(maxSources, getDataSourceLimitMax). Set in Hermes agent config JSON.",
      ),
  })
  .default({})
  .describe("Batch size controls.");

const runPolicySchema = z
  .object({
    minSuccessfulSources: z
      .number()
      .int()
      .nonnegative()
      .default(1)
      .describe("Minimum sources to complete extraction before POST."),
    failOnZeroSuccess: z
      .boolean()
      .default(true)
      .describe(
        "When true, require at least minSuccessfulSources to complete before POST (MP-ART-ANALYSIS-007).",
      ),
  })
  .default({})
  .describe("Run success criteria applied after extraction.");

const dynamicsSchema = z
  .object({
    runDeadlineMs: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Wall-clock budget in ms from run start; skips undispatched sources and late brainstorm/critique.",
      ),
    debounceMinUnanalyzedCount: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe(
        "When greater than zero, skip the run (success no-op) if GET returns fewer unanalyzed sources than this threshold.",
      ),
    debounceMinMinutesSinceLastScore: z
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe(
        "When greater than zero, skip the run if any relevance was scored for this ticker within the last N minutes (requires GET lastRelevanceScoredAtIso).",
      ),
    runPolicy: runPolicySchema,
  })
  .default({})
  .describe("Run timing, debounce, and success criteria.");

/**
 * Hermes agent config for article-analysis (extraction, caps, chunking, relevance, debounce).
 * All defaults are applied inline; Zod output is the fully resolved config type.
 */
export const articleAnalysisConfigSchema = z
  .object({
    verbose: z.boolean().optional(),
    credentials: credentialsSchema,
    extraction: extractionSchema,
    quality: qualitySchema,
    limits: limitsSchema,
    posting: postingSchema,
    scoring: scoringSchema,
    selection: selectionSchema,
    batch: batchSchema,
    dynamics: dynamicsSchema,
    yieldBaseline: z
      .object({
        extractionYieldP50: z.number().min(0).max(1).optional(),
        groundingYieldP50: z.number().min(0).max(1).optional(),
        vocabularyYieldP50: z.number().min(0).max(1).optional(),
      })
      .optional()
      .describe(
        "Operator-supplied yield P50 baselines for regression warnings (not auto-computed from history).",
      ),
  })
  .strict();

export type ArticleAnalysisConfig = z.output<
  typeof articleAnalysisConfigSchema
>;

/**
 * Maps resolved Hermes relevance weights into the v1 weight map used by scoring.
 *
 * @param cfg - Parsed article-analysis config.
 * @returns Weights for canonical breakdown keys.
 */
export const toRelevanceWeightMapV1 = (
  cfg: ArticleAnalysisConfig,
): RelevanceWeightMapV1 => ({
  breakingNews: cfg.scoring.weightBreakingNews,
  kgRelation: cfg.scoring.weightKgRelation,
  fundamental: cfg.scoring.weightFundamental,
  tickerSalience: cfg.scoring.weightTickerSalience,
  sourceQuality: cfg.scoring.weightSourceQuality,
});
