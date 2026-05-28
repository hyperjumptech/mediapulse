import { z } from "zod";

import {
  DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  queryAnalysisIntentSchema,
  type QueryAnalysisIntentWeights,
} from "@workspace/agent-data-api-contract";
import {
  DEFAULT_DETERMINISTIC_PACK,
  DETERMINISTIC_PACK_NAMES,
} from "./templates/deterministic-packs";

/**
 * Resolves intent weights from parsed Hermes config with contract defaults applied.
 *
 * @param output - Parsed `output` group fields related to intent weighting.
 * @returns Full intent weight record for merge math, prompts, and snapshots.
 */
export const resolveIntentWeights = (output: {
  intentWeights?: Partial<QueryAnalysisIntentWeights>;
}): QueryAnalysisIntentWeights => ({
  ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  ...output.intentWeights,
});

const credentialsSchema = z
  .object({
    openaiApiKey: z
      .string()
      .min(1)
      .default("{{OPENAI_API_KEY}}")
      .describe(
        "OpenAI API key or a Hermes variable placeholder such as {{OPENAI_API_KEY}}.",
      ),
    chatModel: z
      .string()
      .min(1)
      .default("{{QUERY_ANALYSIS_MODEL}}")
      .describe(
        "Chat model id for query generation (e.g. gpt-4o-mini) or a Hermes variable placeholder such as {{QUERY_ANALYSIS_MODEL}}.",
      ),
  })
  .default({})
  .describe("OpenAI credentials resolved from Hermes Variables.");

const outputSchema = z
  .object({
    queryCount: z
      .number()
      .int()
      .positive()
      .default(10)
      .describe(
        "Total number of query rows to persist in the active query set.",
      ),
    languageQuotas: z
      .array(
        z.object({
          language: z
            .string()
            .min(1)
            .describe("BCP-47 language tag for this budget slice."),
          share: z
            .number()
            .min(0)
            .max(1)
            .describe(
              "Fraction of queryCount assigned to this language (shares must sum to 1).",
            ),
          templatePack: z
            .string()
            .min(1)
            .optional()
            .describe(
              "Optional deterministic pack override for this language; falls back to the global templates.templatePack.",
            ),
        }),
      )
      .optional()
      .describe(
        "Per-language query budget shares. Omit for English-only (100% en). When set, shares must sum to 1.0.",
      ),
    intentWeights: z
      .record(queryAnalysisIntentSchema, z.number().nonnegative())
      .optional()
      .describe(
        "Relative weights keyed by intent for merge ordering and LLM target counts; omitted keys use contract defaults.",
      ),
  })
  .default({})
  .describe("Query set size, language mix, and intent weighting.");

const samplingSchema = z
  .object({
    temperature: z
      .number()
      .min(0)
      .max(2)
      .default(0.9)
      .describe("LLM sampling temperature (higher = more varied phrasing)."),
    topP: z
      .number()
      .min(0)
      .max(1)
      .default(0.95)
      .describe("Nucleus sampling top-p cutoff."),
    presencePenalty: z
      .number()
      .min(-2)
      .max(2)
      .default(0.4)
      .describe(
        "Penalizes tokens already present in the output (encourages new topics).",
      ),
    frequencyPenalty: z
      .number()
      .min(-2)
      .max(2)
      .default(0.5)
      .describe(
        "Penalizes tokens by prior frequency in the output (reduces repetition).",
      ),
    seed: z
      .number()
      .int()
      .optional()
      .describe(
        "Optional fixed seed for reproducible LLM output during regression hunts.",
      ),
  })
  .default({})
  .describe("OpenAI sampling knobs shared by standard and wildcard LLM calls.");

const templatesSchema = z
  .object({
    templatePack: z
      .enum(DETERMINISTIC_PACK_NAMES)
      .default(DEFAULT_DETERMINISTIC_PACK)
      .describe(
        "Named deterministic template pack for the query floor; switch via Hermes without redeploying.",
      ),
    kgTemplateCap: z
      .number()
      .int()
      .nonnegative()
      .default(6)
      .describe(
        "Maximum KG relation rows expanded into deterministic templates per run; 0 disables KG expansion.",
      ),
  })
  .default({})
  .describe("Deterministic template pack selection and KG expansion cap.");

const promptingSchema = z
  .object({
    personas: z
      .array(z.string().min(1))
      .default(["analyst", "retail", "regulator"])
      .describe(
        "Persona ids from the in-process library to fan out parallel LLM calls.",
      ),
    perPersonaQuotaCount: z
      .number()
      .int()
      .positive()
      .default(3)
      .describe(
        "Maximum structured query rows requested from each persona call.",
      ),
    fewShotExemplarCount: z
      .number()
      .int()
      .min(0)
      .max(6)
      .default(3)
      .describe(
        "Number of curated few-shot exemplars to inject; 0 disables exemplars.",
      ),
  })
  .default({})
  .describe("Persona fan-out and few-shot prompting.");

const creativitySchema = z
  .object({
    wildcardFraction: z
      .number()
      .min(0)
      .max(0.5)
      .default(0.1)
      .describe(
        "Fraction of each query set reserved for stochastic wildcard (lateral) queries.",
      ),
    wildcardTemperature: z
      .number()
      .min(0)
      .max(2)
      .default(1.2)
      .describe(
        "Sampling temperature for wildcard generation (defaults higher than sampling.temperature).",
      ),
    useBrainstormPass: z
      .boolean()
      .default(false)
      .describe(
        "When true, runs a free-form brainstorm pass before structured query generation.",
      ),
    brainstormModel: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Model id for the brainstorm pass; omitted uses credentials.chatModel.",
      ),
  })
  .default({})
  .describe("Wildcard budget and optional brainstorm pass.");

const semanticDedupeSchema = z
  .object({
    enabled: z
      .boolean()
      .default(false)
      .describe(
        "When true, deduplicate LLM candidates via embedding cosine similarity before merge.",
      ),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.85)
      .describe(
        "Cosine-similarity threshold above which a candidate is dropped.",
      ),
    embeddingModel: z
      .string()
      .default("{{EMBEDDING_MODEL}}")
      .describe(
        "OpenAI embedding model name or a Hermes variable placeholder such as {{EMBEDDING_MODEL}}.",
      ),
  })
  .default({})
  .describe("Optional semantic deduplication of LLM candidates.");

const diversityGateSchema = z
  .object({
    enabled: z
      .boolean()
      .default(false)
      .describe(
        "When true, run one broaden regenerate pass when the diversity composite is below threshold.",
      ),
    threshold: z
      .number()
      .min(0)
      .max(1)
      .default(0.6)
      .describe(
        "Minimum composite diversity score before a regenerate pass fires.",
      ),
    weights: z
      .object({
        lexical: z
          .number()
          .nonnegative()
          .default(0.4)
          .describe("Weight for lexical diversity in the composite score."),
        intent: z
          .number()
          .nonnegative()
          .default(0.3)
          .describe("Weight for intent spread in the composite score."),
        semantic: z
          .number()
          .nonnegative()
          .default(0.3)
          .describe("Weight for embedding-based semantic spread."),
      })
      .default({ lexical: 0.4, intent: 0.3, semantic: 0.3 })
      .describe("Axis weights for the diversity composite (should sum to ~1)."),
  })
  .default({})
  .describe("Diversity score gate and optional broaden regenerate pass.");

const qualitySchema = z
  .object({
    useSelfCritique: z
      .boolean()
      .default(false)
      .describe(
        "When true, runs a self-critique pass after LLM generation to replace the weakest rows.",
      ),
    critiqueDropFraction: z
      .number()
      .min(0)
      .max(0.5)
      .default(0.25)
      .describe(
        "Maximum fraction of LLM candidates the critique pass may replace (one-for-one).",
      ),
    critiqueModel: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Model id for the critique pass; omitted uses credentials.chatModel.",
      ),
    semanticDedupe: semanticDedupeSchema,
    diversityGate: diversityGateSchema,
  })
  .default({})
  .describe("Self-critique, semantic dedupe, and diversity gate.");

const temporalBiasSchema = z
  .object({
    enabled: z
      .boolean()
      .default(true)
      .describe(
        "When true, apply conservative calendar-driven intent weight boosts from recent events.",
      ),
  })
  .default({})
  .describe("Calendar-driven intent weight boosts.");

const yieldFeedbackSchema = z
  .object({
    enabled: z
      .boolean()
      .default(false)
      .describe(
        "When true, use rolling query-yield feedback in merge ranking, prompts, and template rotation.",
      ),
    windowDays: z
      .number()
      .int()
      .positive()
      .default(30)
      .describe("Lookback window in days for yield statistics."),
    minTemplateYield: z
      .number()
      .nonnegative()
      .default(0.05)
      .describe(
        "Minimum template yield before rotation deprioritizes a template.",
      ),
  })
  .default({})
  .describe("Rolling query-yield feedback loop.");

const dynamicsSchema = z
  .object({
    temporalBias: temporalBiasSchema,
    yieldFeedback: yieldFeedbackSchema,
  })
  .default({})
  .describe("Adaptive temporal bias and yield feedback.");

/**
 * Runtime configuration from Hermes invoke `config` (variable substitution).
 * OpenAI credentials and strategy knobs are not read from process env.
 *
 * Defaults are applied here so `run.ts` can use config values directly
 * without `??` fallbacks.
 */
export const queryAnalysisConfigSchema = z
  .object({
    credentials: credentialsSchema,
    output: outputSchema,
    sampling: samplingSchema,
    templates: templatesSchema,
    prompting: promptingSchema,
    creativity: creativitySchema,
    quality: qualitySchema,
    dynamics: dynamicsSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    const quotas = data.output.languageQuotas;
    if (quotas !== undefined && quotas.length > 0) {
      const sum = quotas.reduce((total, quota) => total + quota.share, 0);
      if (Math.abs(sum - 1) > 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `languageQuotas shares must sum to 1.0 (received ${String(sum)})`,
          path: ["output", "languageQuotas"],
        });
      }
    }
  });

/** Parsed invoke config with all group and field defaults applied. */
export type QueryAnalysisConfig = z.output<typeof queryAnalysisConfigSchema>;
