import { z } from "zod";

/**
 * Runtime config for the content-generation agent, supplied by Hermes on each invocation
 * (from the admin-selected agent config for the pipeline step).
 */
export const ContentGenerationConfigSchema = z
  .object({
    /**
     * @deprecated Use `openai.apiKey` instead.
     * OpenAI API key for newsletter generation.
     */
    openaiApiKey: z.string().min(1).optional(),
    /**
     * @deprecated Use `openai.baseUrl` instead.
     * Base URL for the OpenAI-compatible HTTP API.
     */
    openaiBaseUrl: z.string().url().optional(),
    /**
     * @deprecated Use `openai.model` instead.
     * Chat completions model id.
     */
    openaiModel: z.string().min(1).optional(),

    openai: z
      .object({
        /**
         * OpenAI API key for newsletter generation. Required if legacy `openaiApiKey` is omitted.
         * The agent reads the API key exclusively from Hermes config — do not fall back to
         * process.env.OPENAI_API_KEY at runtime. For local development, set the key in the
         * Hermes agent config or use the legacy `openaiApiKey` top-level field.
         * See FR2 and MP-CGA-011 for full local-dev documentation.
         */
        apiKey: z.string().min(1).optional(),
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
      })
      .default({}),

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
  .superRefine((data, ctx) => {
    if (!data.openaiApiKey && !data.openai?.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Missing API key. Provide either openaiApiKey or openai.apiKey",
        path: ["openai", "apiKey"],
      });
    }
  });

export type ContentGenerationConfig = z.infer<
  typeof ContentGenerationConfigSchema
>;
