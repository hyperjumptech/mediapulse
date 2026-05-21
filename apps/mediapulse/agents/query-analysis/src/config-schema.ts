import { z } from "zod";

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
     * Relative weights used to shape ordering / selection of the non-deterministic pool.
     */
    weightBreaking: z.number().nonnegative().optional().default(1),
    weightKgChange: z.number().nonnegative().optional().default(0.8),
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
            "Optional system prompt template. Placeholders: {{allowedLanguages}}, {{targetBreakingCount}}, {{targetKgCount}}, {{targetFundamentalCount}}, {{minDeterministicCount}} (derived from queryCount, allowedLanguages, minDeterministicCount, and weight* fields when overrides are absent).",
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
