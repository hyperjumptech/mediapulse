import { z } from "zod";

/**
 * Runtime config for the content-generation agent, supplied by Hermes on each invocation
 * (from the admin-selected agent config for the pipeline step).
 */
export const ContentGenerationConfigSchema = z
  .object({
    /**
     * OpenAI client settings. The API key is read only from Hermes config (no
     * `process.env.OPENAI_API_KEY` at runtime). See FR2 and MP-CGA-011 for local-dev notes.
     */
    openai: z.object({
      /** OpenAI API key for newsletter generation (required, non-whitespace). */
      apiKey: z
        .string()
        .min(1, "openai.apiKey is required")
        .refine((k) => k.trim().length > 0, {
          message: "openai.apiKey cannot be whitespace only",
        }),
      /** Base URL for the OpenAI-compatible HTTP API (e.g. Azure OpenAI or a proxy). */
      baseUrl: z.string().url().optional(),
      /** Chat completions model id (e.g. `gpt-4o-mini`). */
      model: z.string().min(1).default("gpt-4o-mini"),
      /** Sampling temperature. */
      temperature: z.number().min(0).max(2).default(0.4),
      /** Maximum tokens to generate. */
      maxTokens: z.number().int().positive().optional(),
      /** Timeout in milliseconds for the OpenAI API call. */
      timeoutMs: z.number().int().positive().default(120000),
    }),

    prompts: z
      .object({
        /** System prompt for the agent. */
        systemPrompt: z.string().optional(),
        /**
         * User prompt template.
         * Supported placeholders: {{sourceSummaries}}, {{tickerId}}, {{date}}, {{topNewsCount}}
         */
        userPromptTemplate: z.string().optional(),
      })
      .default({}),

    output: z
      .object({
        /** Number of top news items to include in the output. */
        topNewsCount: z.number().int().positive().default(3),
      })
      .default({}),

    context: z
      .object({
        /** Maximum characters to keep per source. */
        maxCharsPerSource: z.number().int().positive().default(8000),
        /** Maximum total characters across all sources. */
        maxTotalContextChars: z.number().int().positive().default(100000),
      })
      .default({}),

    llmRetry: z
      .object({
        /** Maximum number of retry attempts for LLM calls. */
        maxAttempts: z.number().int().nonnegative().default(3),
        /** Base delay in milliseconds between retries. */
        baseDelayMs: z.number().int().nonnegative().default(500),
        /** Maximum delay in milliseconds between retries. */
        maxDelayMs: z.number().int().nonnegative().default(8000),
        /** Whether to add jitter to the retry delay. */
        jitter: z.boolean().default(true),
      })
      .default({}),

    freshness: z
      .object({
        /** Strategy to use for determining freshness. */
        strategy: z.literal("calendar_day").default("calendar_day"),
        /** Timezone to use for freshness calculations (e.g. "Asia/Jakarta"). */
        timezone: z
          .string()
          .refine(
            (tz) => {
              try {
                Intl.DateTimeFormat(undefined, { timeZone: tz });
                return true;
              } catch {
                return false;
              }
            },
            { message: "Invalid IANA timezone" },
          )
          .default("Asia/Jakarta"),
      })
      .default({
        strategy: "calendar_day",
        timezone: "Asia/Jakarta",
      }),

    persistRetry: z
      .object({
        /** Maximum number of retry attempts for persisting data. */
        maxAttempts: z.number().int().nonnegative().default(2),
        /** Base delay in milliseconds between retries. */
        baseDelayMs: z.number().int().nonnegative().default(200),
        /** Maximum delay in milliseconds between retries. */
        maxDelayMs: z.number().int().nonnegative().default(2000),
      })
      .default({}),
  })
  /** Reject unknown keys (e.g. removed top-level `openaiApiKey`) so configs fail fast. */
  .strict();

export type ContentGenerationConfig = z.infer<
  typeof ContentGenerationConfigSchema
>;
