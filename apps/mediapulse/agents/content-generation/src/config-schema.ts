import { z } from "zod";

import { findUnknownLlmPromptPlaceholderTokens } from "@workspace/agent-llm-prompt-template";

/** Maximum length for each optional `prompts.*` string (Hermes JSON config). */
export const CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH = 50_000;

const contentGenerationSystemPromptPlaceholders = new Set([
  "topNewsCount",
  "tickerId",
  "tickerName",
  "tickerSymbol",
]);

const contentGenerationUserPromptPlaceholders = new Set([
  "sourceSummaries",
  "tickerId",
  "tickerName",
  "tickerSymbol",
  "date",
  "topNewsCount",
]);

const llmRetrySchema = z.object({
  /** Maximum total attempts (including the first). */
  maxAttempts: z.number().int().nonnegative().optional(),
  /** Base delay in milliseconds before the first retry. */
  baseDelayMs: z.number().int().nonnegative().optional(),
  /** Maximum delay cap in milliseconds. */
  maxDelayMs: z.number().int().nonnegative().optional(),
  /** When true, applies ±50% random jitter to each computed backoff delay. */
  jitter: z.boolean().optional(),
});

const openaiOptionsSchema = z.object({
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
  model: z.string().min(1).optional(),
  /** Maximum tokens to generate. */
  maxTokens: z.number().int().positive().optional(),
  /** Per-request timeout in milliseconds passed to the AI SDK `generateObject` call. */
  timeoutMs: z.number().int().positive().optional(),
});

const outputSchema = z.object({
  /** Number of top news items to include in the output. */
  topNewsCount: z.number().int().positive().optional(),
});

const contextSchema = z.object({
  /** Maximum characters to keep per source. */
  maxCharsPerSource: z.number().int().positive().optional(),
  /** Maximum total characters across all sources. */
  maxTotalContextChars: z.number().int().positive().optional(),
});

const freshnessSchema = z.object({
  /** Strategy to use for determining freshness. */
  strategy: z.literal("calendar_day").optional(),
  /**
   * Timezone to use for freshness calculations (IANA, e.g. "Asia/Jakarta").
   * Validated against the IANA database at config-parse time.
   */
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
    .optional(),
});

const persistRetrySchema = z.object({
  /** Maximum number of retry attempts for persisting data. */
  maxAttempts: z.number().int().nonnegative().optional(),
  /** Base delay in milliseconds between retries. */
  baseDelayMs: z.number().int().nonnegative().optional(),
  /** Maximum delay in milliseconds between retries. */
  maxDelayMs: z.number().int().nonnegative().optional(),
});

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
      /** Maximum tokens to generate. */
      maxTokens: z.number().int().positive().optional(),
      /** Timeout in milliseconds for the OpenAI API call. */
      timeoutMs: z.number().int().positive().default(120000),
    }),

    prompts: z
      .object({
        /**
         * System prompt template. Defaults in code apply when omitted.
         * Supported placeholders: `{{topNewsCount}}`, `{{tickerId}}`, `{{tickerName}}`, `{{tickerSymbol}}`.
         * Do not put API keys or secrets here — use `openai.apiKey` only.
         */
        systemPrompt: z
          .string()
          .max(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH, {
            message: `prompts.systemPrompt must be at most ${String(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
          })
          .optional(),
        /**
         * User prompt template. Supported placeholders: `{{sourceSummaries}}`, `{{tickerId}}`,
         * `{{tickerName}}`, `{{tickerSymbol}}`, `{{date}}`, `{{topNewsCount}}`.
         * Do not put API keys or secrets here — use `openai.apiKey` only.
         */
        userPromptTemplate: z
          .string()
          .max(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH, {
            message: `prompts.userPromptTemplate must be at most ${String(CONTENT_GENERATION_LLM_PROMPT_FIELD_MAX_LENGTH)} characters`,
          })
          .optional(),
      })
      .default({}),

    output: z
      .object({
        /** Number of top news items to include in the output. */
        topNewsCount: z.number().int().positive().default(10),
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

    llmRetry: z.preprocess(
      (value) => (value === undefined ? { __defaultLlmRetry: true } : value),
      z
        .object({
          __defaultLlmRetry: z.literal(true).optional(),
          /** Maximum number of retry attempts for LLM calls. */
          maxAttempts: z.number().int().nonnegative().optional(),
          /** Base delay in milliseconds between retries. */
          baseDelayMs: z.number().int().nonnegative().optional(),
          /** Maximum delay in milliseconds between retries. */
          maxDelayMs: z.number().int().nonnegative().optional(),
          /** Whether to add jitter to the retry delay. */
          jitter: z.boolean().optional(),
        })
        .transform((parsed) => {
          if (parsed.__defaultLlmRetry) {
            return {
              maxAttempts: 3,
              baseDelayMs: 500,
              maxDelayMs: 8000,
              jitter: true,
            };
          }
          const { __defaultLlmRetry, ...rest } = parsed;
          return rest;
        }),
    ),

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

    persistRetry: z.preprocess(
      (value) =>
        value === undefined ? { __defaultPersistRetry: true } : value,
      z
        .object({
          __defaultPersistRetry: z.literal(true).optional(),
          /** Maximum number of retry attempts for persisting data. */
          maxAttempts: z.number().int().nonnegative().optional(),
          /** Base delay in milliseconds between retries. */
          baseDelayMs: z.number().int().nonnegative().optional(),
          /** Maximum delay in milliseconds between retries. */
          maxDelayMs: z.number().int().nonnegative().optional(),
        })
        .transform((parsed) => {
          if (parsed.__defaultPersistRetry) {
            return {
              maxAttempts: 2,
              baseDelayMs: 200,
              maxDelayMs: 2000,
            };
          }
          const { __defaultPersistRetry, ...rest } = parsed;
          return rest;
        }),
    ),
  })
  /** Reject unknown keys (e.g. removed top-level `openaiApiKey`) so configs fail fast. */
  .strict()
  .superRefine((data, ctx) => {
    const prompts = data.prompts;
    if (prompts.systemPrompt) {
      for (const token of findUnknownLlmPromptPlaceholderTokens(
        prompts.systemPrompt,
        contentGenerationSystemPromptPlaceholders,
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
        contentGenerationUserPromptPlaceholders,
      )) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown placeholder {{${token}}} in prompts.userPromptTemplate`,
          path: ["prompts", "userPromptTemplate"],
        });
      }
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

/** Fully resolved persistence retry settings. */
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
 * @param config - Parsed and validated Hermes agent config.
 * @returns Config safe to use at runtime.
 */
export function resolveContentGenerationConfig(
  config: any,
): ResolvedContentGenerationConfig {
  const parsed = ContentGenerationConfigSchema.parse(config);

  return {
    ...parsed,
    llmRetry: {
      maxAttempts:
        parsed.llmRetry?.maxAttempts ??
        contentGenerationConfigDefaults.llmRetry.maxAttempts,
      baseDelayMs:
        parsed.llmRetry?.baseDelayMs ??
        contentGenerationConfigDefaults.llmRetry.baseDelayMs,
      maxDelayMs:
        parsed.llmRetry?.maxDelayMs ??
        contentGenerationConfigDefaults.llmRetry.maxDelayMs,
      jitter:
        parsed.llmRetry?.jitter ??
        contentGenerationConfigDefaults.llmRetry.jitter,
    },
    persistRetry: {
      maxAttempts:
        parsed.persistRetry?.maxAttempts ??
        contentGenerationConfigDefaults.persistRetry.maxAttempts,
      baseDelayMs:
        parsed.persistRetry?.baseDelayMs ??
        contentGenerationConfigDefaults.persistRetry.baseDelayMs,
      maxDelayMs:
        parsed.persistRetry?.maxDelayMs ??
        contentGenerationConfigDefaults.persistRetry.maxDelayMs,
    },
  } as ResolvedContentGenerationConfig;
}
