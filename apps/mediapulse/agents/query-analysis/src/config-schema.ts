import { z } from "zod";

import {
  DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  queryAnalysisIntentSchema,
  type QueryAnalysisIntent,
  type QueryAnalysisIntentWeights,
} from "@workspace/agent-data-api-contract";
import { findUnknownLlmPromptPlaceholderTokens } from "@workspace/agent-llm-prompt-template";
import {
  DEFAULT_DETERMINISTIC_PACK,
  DETERMINISTIC_PACK_NAMES,
} from "./templates/deterministic-packs";
import {
  QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH,
  QUERY_ANALYSIS_SYSTEM_PROMPT_PLACEHOLDERS,
  QUERY_ANALYSIS_USER_PROMPT_PLACEHOLDERS,
} from "./query-analysis-prompt-defaults";

/**
 * Resolves intent weights from Hermes config, lifting legacy `weight*` fields when
 * `intentWeights` is absent.
 *
 * @param config - Parsed invoke config fields related to intent weighting.
 * @returns Full intent weight record with defaults for any omitted intents.
 */
export const resolveIntentWeights = (config: {
  intentWeights?: Partial<QueryAnalysisIntentWeights>;
  weightBreaking?: number;
  weightKgChange?: number;
  weightFundamental?: number;
}): QueryAnalysisIntentWeights => {
  if (config.intentWeights !== undefined) {
    return {
      ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
      ...config.intentWeights,
    };
  }
  return {
    ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    breaking:
      config.weightBreaking ?? DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS.breaking,
    kg_change:
      config.weightKgChange ?? DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS.kg_change,
    fundamental:
      config.weightFundamental ??
      DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS.fundamental,
  };
};

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
     * Minimum number of deterministic template queries to include
     * before the LLM-generated candidates are used to fill the remaining budget.
     */
    minDeterministicCount: z.number().int().nonnegative().optional().default(4),
    /**
     * Target languages (BCP-47 codes) for LLM-generated query text.
     */
    allowedLanguages: z.array(z.string().min(1)).optional().default(["en"]),
    /**
     * Relative weights keyed by intent for merge ordering and LLM target counts.
     */
    intentWeights: z
      .record(queryAnalysisIntentSchema, z.number().nonnegative())
      .optional(),
    /**
     * @deprecated Use `intentWeights.breaking`. Lifted when `intentWeights` is absent.
     */
    weightBreaking: z.number().nonnegative().optional().default(1),
    /**
     * @deprecated Use `intentWeights.kg_change`. Lifted when `intentWeights` is absent.
     */
    weightKgChange: z.number().nonnegative().optional().default(0.8),
    /**
     * @deprecated Use `intentWeights.fundamental`. Lifted when `intentWeights` is absent.
     */
    weightFundamental: z.number().nonnegative().optional().default(0.6),
    /**
     * LLM output token budget for generating structured query candidates.
     */
    maxTokens: z.number().int().positive().optional().default(800),
    /**
     * Named deterministic template pack used for the query floor.
     * Switch via Hermes invoke config without redeploying the agent.
     */
    templatePack: z
      .enum(DETERMINISTIC_PACK_NAMES)
      .optional()
      .default(DEFAULT_DETERMINISTIC_PACK),
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
     * Optional overrides for query-generation LLM system/user templates (Hermes).
     * When omitted, built-in defaults are used. Do not put API keys inside prompt text.
     */
    prompts: z
      .object({
        systemPrompt: z
          .string()
          .max(QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH, {
            message: `prompts.systemPrompt must be at most ${String(QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
          })
          .describe(
            "Optional system prompt template. Placeholders: {{allowedLanguages}}, {{targetBreakingCount}}, {{targetKgCount}}, {{targetFundamentalCount}}, {{targetSentimentCount}}, {{targetCompetitorCount}}, {{targetSupplyChainCount}}, {{targetEsgCount}}, {{targetMacroCount}}, {{targetTechnicalCount}}, {{minDeterministicCount}} (derived from queryCount, allowedLanguages, minDeterministicCount, and intentWeights when overrides are absent).",
          )
          .optional(),
        userPromptTemplate: z
          .string()
          .max(QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH, {
            message: `prompts.userPromptTemplate must be at most ${String(QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
          })
          .describe(
            "Optional user prompt template. Placeholder: {{queryContextBlock}} (serialized GET /query-analysis context: ticker, entities, themes, relation deltas).",
          )
          .optional(),
      })
      .strict()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const prompts = data.prompts;
    if (!prompts) {
      return;
    }
    const systemAllowed = new Set<string>(
      QUERY_ANALYSIS_SYSTEM_PROMPT_PLACEHOLDERS,
    );
    const userAllowed = new Set<string>(
      QUERY_ANALYSIS_USER_PROMPT_PLACEHOLDERS,
    );
    if (prompts.systemPrompt) {
      for (const token of findUnknownLlmPromptPlaceholderTokens(
        prompts.systemPrompt,
        systemAllowed,
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
        userAllowed,
      )) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown placeholder {{${token}}} in prompts.userPromptTemplate`,
          path: ["prompts", "userPromptTemplate"],
        });
      }
    }
  });

// Use Zod *input* type so `createAgentApp`'s Zod generic constraints match.
// The agent runtime always parses with this schema, so defaults are guaranteed at runtime.
export type QueryAnalysisConfig = z.input<typeof queryAnalysisConfigSchema>;
