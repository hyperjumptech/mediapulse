import { z } from "zod";

/**
 * Runtime config for the newsletter-feedback agent, supplied by Hermes on each
 * invocation. Two grouped objects only: Outlook credentials and the LLM model.
 */
export const ConfigSchema = z.object({
  outlook: z.object({
    userId: z.string().min(1),
    clientId: z.string().min(1),
    tenantId: z.string().min(1),
    clientSecret: z.string().min(1),
  }),
  model: z.object({
    apiKey: z.string().min(1),
    model: z.string().min(1),
    /** OpenAI-compatible API base URL (gateway/proxy); omit to use the provider default. */
    baseUrl: z.string().url().optional(),
  }),
});

export type NewsletterFeedbackConfig = z.input<typeof ConfigSchema>;
