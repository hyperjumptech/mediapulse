import { z } from "zod";

/**
 * Runtime config for the content-generation agent, supplied by Hermes on each invocation
 * (from the admin-selected agent config for the pipeline step).
 */
export const ContentGenerationConfigSchema = z.object({
  /** OpenAI API key for newsletter generation. */
  openaiApiKey: z.string().min(1),
  /**
   * Base URL for the OpenAI-compatible HTTP API (e.g. Azure OpenAI or a proxy).
   * When omitted, the official OpenAI endpoint is used.
   */
  openaiBaseUrl: z.string().url().optional(),
  /**
   * Chat completions **model id** only (e.g. `gpt-4o-mini`). Do not put the API base URL here;
   * use `openaiBaseUrl` for a non-default host (Azure OpenAI, proxies, etc.).
   * When omitted, the agent uses `gpt-4o-mini`.
   */
  openaiModel: z.string().min(1).optional(),
});

export type ContentGenerationConfig = z.infer<
  typeof ContentGenerationConfigSchema
>;
