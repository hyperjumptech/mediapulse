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
         * the `OPENAI_API_KEY` environment variable at runtime. For local development, set the
         * key in the Hermes agent config or use the legacy `openaiApiKey` top-level field.
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
        /**
         * Per-request timeout in milliseconds passed to the AI SDK `generateObject` call.
         * When omitted, no timeout is applied.
         */
        timeoutMs: z.number().int().positive().default(120000),
      })
      .default({}),

    prompts: z
      .object({
        /** System prompt for the agent. */
        systemPrompt: z.string().optional(),
        /**
         * User prompt template.
         * Supported placeholders: {{sourceSummaries}}, {{tickerId}}, {{date}}
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
        /** Maximum number of retry attempts for LLM calls (including the first). */
        maxAttempts: z.number().int().positive().default(3),
        /** Base delay in milliseconds between retries. */
        baseDelayMs: z.number().int().positive().default(500),
        /** Maximum delay in milliseconds between retries. */
        maxDelayMs: z.number().int().positive().default(8000),
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

    // No jitter field — persistRetry uses fixed exponential backoff without jitter
    // (unlike llmRetry). This is an intentional PRD design choice, not an oversight.
    persistRetry: z
      .object({
        /** Maximum number of retry attempts for persisting data. */
        maxAttempts: z.number().int().positive().default(2),
        /** Base delay in milliseconds between retries. */
        baseDelayMs: z.number().int().positive().default(200),
        /** Maximum delay in milliseconds between retries. */
        maxDelayMs: z.number().int().positive().default(2000),
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

/** Fully resolved LLM retry settings (all fields guaranteed to be present). */
export type ResolvedLlmRetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
};

/** Fully resolved persist retry settings (all fields guaranteed present, no jitter). */
export type ResolvedPersistRetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

/**
 * Content-generation config with optional fields resolved to their production defaults.
 * Use {@link resolveContentGenerationConfig} to obtain this from a parsed config.
 */
export type ResolvedContentGenerationConfig = ContentGenerationConfig & {
  llmRetry: ResolvedLlmRetryConfig;
  persistRetry: ResolvedPersistRetryConfig;
};

/** Production defaults for fields that may be omitted in Hermes config. */
export const contentGenerationConfigDefaults = {
  llmRetry: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 8000,
    jitter: true,
  },
  persistRetry: {
    maxAttempts: 2,
    baseDelayMs: 200,
    maxDelayMs: 2000,
  },
} as const;

/**
 * Merges Hermes-supplied config with production defaults for optional fields.
 *
 * @param input - Raw Hermes agent config (may omit optional fields with defaults).
 * @returns Config safe to use at runtime; all optional fields with defaults are resolved.
 */
export function resolveContentGenerationConfig(
  input: z.input<typeof ContentGenerationConfigSchema>,
): ResolvedContentGenerationConfig {
  const config = ContentGenerationConfigSchema.parse(input);
  const defaults = contentGenerationConfigDefaults.llmRetry;

  // Prioritize new openai group over legacy fields
  const apiKey = config.openai?.apiKey ?? config.openaiApiKey;
  const model = config.openai?.model ?? config.openaiModel ?? "gpt-4o-mini";
  const baseUrl = config.openai?.baseUrl ?? config.openaiBaseUrl;

  const persistDefaults = contentGenerationConfigDefaults.persistRetry;

  return {
    ...config,
    openai: {
      ...config.openai,
      apiKey,
      model,
      baseUrl,
    },
    llmRetry: {
      maxAttempts: config.llmRetry?.maxAttempts ?? defaults.maxAttempts,
      baseDelayMs: config.llmRetry?.baseDelayMs ?? defaults.baseDelayMs,
      maxDelayMs: config.llmRetry?.maxDelayMs ?? defaults.maxDelayMs,
      jitter: config.llmRetry?.jitter ?? defaults.jitter,
    },
    persistRetry: {
      maxAttempts:
        config.persistRetry?.maxAttempts ?? persistDefaults.maxAttempts,
      baseDelayMs:
        config.persistRetry?.baseDelayMs ?? persistDefaults.baseDelayMs,
      maxDelayMs: config.persistRetry?.maxDelayMs ?? persistDefaults.maxDelayMs,
    },
  };
}
