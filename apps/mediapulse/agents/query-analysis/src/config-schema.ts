import { z } from "zod";

/**
 * Runtime config supplied by Hermes Agent Configs for query-analysis.
 */
export const QueryAnalysisConfigSchema = z.object({
  /** OpenAI API key used for optional LLM expansion. */
  openaiApiKey: z.string().min(1).optional(),
  /** Chat model id (e.g. gpt-4o-mini). */
  openaiModel: z.string().min(1).optional(),
});

export type QueryAnalysisConfig = z.infer<typeof QueryAnalysisConfigSchema>;
