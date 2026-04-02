import { z } from "zod";

/**
 * Runtime configuration from Hermes invoke `config` (variable substitution).
 * OpenAI credentials and strategy knobs are not read from process env.
 * Optional fields use agent defaults when Hermes omits them.
 */
export const queryAnalysisConfigSchema = z.object({
  openaiApiKey: z.string().min(1),
  openaiModel: z.string().min(1).optional(),
  queryCount: z.number().int().positive().optional(),
  minDeterministicCount: z.number().int().nonnegative().optional(),
  allowedLanguages: z.array(z.string().min(1)).optional(),
  weightBreaking: z.number().nonnegative().optional(),
  weightKgChange: z.number().nonnegative().optional(),
  weightFundamental: z.number().nonnegative().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export type QueryAnalysisConfig = z.infer<typeof queryAnalysisConfigSchema>;
