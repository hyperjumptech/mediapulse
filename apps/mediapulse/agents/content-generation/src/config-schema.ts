import { z } from "zod";

/**
 * Runtime config for the content-generation agent, supplied by Hermes on each invocation
 * (from the admin-selected agent config for the pipeline step).
 */
export const ContentGenerationConfigSchema = z.object({
  /** OpenAI API key for newsletter generation. */
  openaiApiKey: z.string().min(1),
  /**
   * Chat model id (e.g. gpt-4o-mini). When omitted, the agent uses `gpt-4o-mini`.
   */
  openaiModel: z.string().min(1).optional(),
});

export type ContentGenerationConfig = z.infer<
  typeof ContentGenerationConfigSchema
>;
