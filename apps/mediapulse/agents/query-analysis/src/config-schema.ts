import { z } from "zod";

/**
 * Runtime configuration for query generation weights and limits.
 */
export const queryAnalysisConfigSchema = z.object({
  openaiApiKey: z.string().min(1),
  openaiModel: z.string().min(1).default("gpt-4o-mini"),
  queryCount: z.number().int().positive().default(10),
  minDeterministicCount: z.number().int().nonnegative().default(4),
  allowedLanguages: z.array(z.string().min(1)).default(["en"]),
  weightBreaking: z.number().nonnegative().default(1),
  weightKgChange: z.number().nonnegative().default(0.8),
  weightFundamental: z.number().nonnegative().default(0.6),
  maxTokens: z.number().int().positive().optional(),
});

export type QueryAnalysisConfig = z.input<typeof queryAnalysisConfigSchema>;
