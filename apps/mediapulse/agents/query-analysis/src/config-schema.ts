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
 * @param config - Parsed invoke config fields related to intent weighting.
 * @returns Full intent weight record for merge math, prompts, and snapshots.
 */
export const resolveIntentWeights = (config: {
  intentWeights?: Partial<QueryAnalysisIntentWeights>;
}): QueryAnalysisIntentWeights => ({
  ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  ...config.intentWeights,
});

/** Resolved diversity gate settings with defaults applied. */
export type ResolvedDiversityGateConfig = {
  enabled: boolean;
  threshold: number;
  weights: {
    lexical: number;
    intent: number;
    semantic: number;
  };
};

/** Resolved temporal event-bias settings with defaults applied. */
export type ResolvedTemporalBiasConfig = {
  enabled: boolean;
};

/** Resolved yield feedback settings with defaults applied. */
export type ResolvedYieldFeedbackConfig = {
  enabled: boolean;
  windowDays: number;
  minTemplateYield: number;
};

/**
 * Resolves yield feedback config with schema defaults when fields are omitted.
 *
 * @param config - Parsed or raw Hermes invoke config.
 * @returns Effective yield feedback settings for merge, prompts, and template rotation.
 */
export const resolveYieldFeedbackConfig = (config: {
  yieldFeedback?: {
    enabled?: boolean;
    windowDays?: number;
    minTemplateYield?: number;
  };
}): ResolvedYieldFeedbackConfig => ({
  enabled: config.yieldFeedback?.enabled ?? false,
  windowDays: config.yieldFeedback?.windowDays ?? 30,
  minTemplateYield: config.yieldFeedback?.minTemplateYield ?? 0.05,
});

/**
 * Resolves temporal event-bias config with schema defaults when fields are omitted.
 *
 * @param config - Parsed or raw Hermes invoke config.
 * @returns Effective temporal bias toggle for the run loop.
 */
export const resolveTemporalBiasConfig = (config: {
  temporalBias?: {
    enabled?: boolean;
  };
}): ResolvedTemporalBiasConfig => ({
  enabled: config.temporalBias?.enabled ?? true,
});

/**
 * Resolves diversity gate config with schema defaults when fields are omitted.
 *
 * @param config - Parsed or raw Hermes invoke config.
 * @returns Effective gate settings for scoring and regenerate decisions.
 */
export const resolveDiversityGateConfig = (config: {
  diversityGate?: {
    enabled?: boolean;
    threshold?: number;
    weights?: {
      lexical?: number;
      intent?: number;
      semantic?: number;
    };
  };
}): ResolvedDiversityGateConfig => {
  const gate = config.diversityGate;
  return {
    enabled: gate?.enabled ?? false,
    threshold: gate?.threshold ?? 0.6,
    weights: {
      lexical: gate?.weights?.lexical ?? 0.4,
      intent: gate?.weights?.intent ?? 0.3,
      semantic: gate?.weights?.semantic ?? 0.3,
    },
  };
};

/**
 * Runtime configuration from Hermes invoke `config` (variable substitution).
 * OpenAI credentials and strategy knobs are not read from process env.
 *
 * Defaults are applied here so `run.ts` can use config values directly
 * without `??` fallbacks.
 */
export const queryAnalysisConfigSchema = z
  .object({
    openaiApiKey: z.string().min(1),
    /**
     * Chat model id used for query generation (e.g. `gpt-4o-mini`).
     * When omitted by Hermes, defaults to `gpt-4o-mini`.
     */
    openaiModel: z.string().min(1).optional().default("gpt-4o-mini"),
    /**
     * Total number of query rows to persist in the active query set.
     */
    queryCount: z.number().int().positive().optional().default(10),
    /**
     * Per-language query budget shares and optional template pack overrides.
     */
    languageQuotas: z
      .array(
        z.object({
          language: z.string().min(1),
          share: z.number().min(0).max(1),
          templatePack: z.string().min(1).optional(),
        }),
      )
      .optional(),
    /**
     * Relative weights keyed by intent for merge ordering and LLM target counts.
     */
    intentWeights: z
      .record(queryAnalysisIntentSchema, z.number().nonnegative())
      .optional(),
    /**
     * Named deterministic template pack used for the query floor.
     * Switch via Hermes invoke config without redeploying the agent.
     */
    templatePack: z
      .enum(DETERMINISTIC_PACK_NAMES)
      .optional()
      .default(DEFAULT_DETERMINISTIC_PACK),
    /**
     * Maximum KG relation rows expanded into deterministic templates per run.
     * `0` disables KG-template expansion without changing the pack.
     */
    kgTemplateCap: z.number().int().nonnegative().optional().default(6),
    /**
     * LLM sampling temperature (higher = more varied phrasing).
     */
    temperature: z.number().min(0).max(2).optional().default(0.9),
    /**
     * Nucleus sampling top-p cutoff.
     */
    topP: z.number().min(0).max(1).optional().default(0.95),
    /**
     * Penalizes tokens already present in the output (encourages new topics).
     */
    presencePenalty: z.number().min(-2).max(2).optional().default(0.4),
    /**
     * Penalizes tokens by prior frequency in the output (reduces repetition).
     */
    frequencyPenalty: z.number().min(-2).max(2).optional().default(0.5),
    /**
     * Optional fixed seed for reproducible LLM output during regression hunts.
     */
    seed: z.number().int().optional(),
    /**
     * Fraction of each query set reserved for stochastic wildcard (lateral) queries.
     */
    wildcardFraction: z.number().min(0).max(0.5).optional().default(0.1),
    /**
     * Sampling temperature for wildcard generation (defaults higher than `temperature`).
     */
    wildcardTemperature: z.number().min(0).max(2).optional().default(1.2),
    /**
     * When true, runs a free-form brainstorm pass before structured query generation.
     */
    useBrainstormPass: z.boolean().optional().default(false),
    /**
     * Model id for the brainstorm pass (defaults to `openaiModel` in `run.ts` when omitted).
     */
    brainstormModel: z.string().min(1).optional(),
    /**
     * Number of curated few-shot exemplars to inject (0 disables exemplars).
     */
    fewShotExemplarCount: z.number().int().min(0).max(6).optional().default(3),
    /**
     * Persona ids from the in-process library to fan out parallel LLM calls.
     */
    personas: z
      .array(z.string().min(1))
      .optional()
      .default(["analyst", "retail", "regulator"]),
    /**
     * Maximum structured query rows requested from each persona call.
     */
    perPersonaQuotaCount: z.number().int().positive().optional().default(3),
    /**
     * When true, runs a self-critique pass after LLM generation to replace the weakest rows.
     */
    useSelfCritique: z.boolean().optional().default(false),
    /**
     * Maximum fraction of LLM candidates the critique pass may replace (one-for-one).
     */
    critiqueDropFraction: z.number().min(0).max(0.5).optional().default(0.25),
    /**
     * Model id for the critique pass (defaults to `openaiModel` in `run.ts` when omitted).
     */
    critiqueModel: z.string().min(1).optional(),
    /**
     * Optional semantic deduplication of LLM candidates via embedding cosine similarity.
     */
    semanticDedupe: z
      .object({
        enabled: z.boolean().default(false),
        threshold: z.number().min(0).max(1).default(0.85),
        embeddingModel: z.string().default("text-embedding-3-small"),
      })
      .optional(),
    /**
     * Optional diversity score gate: one broaden regenerate pass when composite is below threshold.
     */
    diversityGate: z
      .object({
        enabled: z.boolean().default(false),
        threshold: z.number().min(0).max(1).default(0.6),
        weights: z
          .object({
            lexical: z.number().nonnegative().default(0.4),
            intent: z.number().nonnegative().default(0.3),
            semantic: z.number().nonnegative().default(0.3),
          })
          .default({ lexical: 0.4, intent: 0.3, semantic: 0.3 }),
      })
      .optional(),
    /**
     * Optional calendar-driven intent weight boosts (default on; conservative multipliers).
     */
    temporalBias: z
      .object({
        enabled: z.boolean().default(true),
      })
      .optional(),
    /**
     * Optional rolling query-yield feedback loop (merge ranking, prompts, template rotation).
     */
    yieldFeedback: z
      .object({
        enabled: z.boolean().default(false),
        windowDays: z.number().int().positive().default(30),
        minTemplateYield: z.number().nonnegative().default(0.05),
      })
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.languageQuotas !== undefined && data.languageQuotas.length > 0) {
      const sum = data.languageQuotas.reduce(
        (total, quota) => total + quota.share,
        0,
      );
      if (Math.abs(sum - 1) > 0.001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `languageQuotas shares must sum to 1.0 (received ${String(sum)})`,
          path: ["languageQuotas"],
        });
      }
    }
  });

// Use Zod *input* type so `createAgentApp`'s Zod generic constraints match.
// The agent runtime always parses with this schema, so defaults are guaranteed at runtime.
export type QueryAnalysisConfig = z.input<typeof queryAnalysisConfigSchema>;
