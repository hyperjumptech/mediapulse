import { z } from "zod";

const llmRetrySchema = z.object({
  /** Maximum total attempts (including the first). */
  maxAttempts: z.number().int().positive().optional(),
  /** Base delay in milliseconds before the first retry. */
  baseDelayMs: z.number().int().positive().optional(),
  /** Maximum delay cap in milliseconds. */
  maxDelayMs: z.number().int().positive().optional(),
  /** When true, applies ±50% random jitter to each computed backoff delay. */
  jitter: z.boolean().optional(),
});

const openaiOptionsSchema = z.object({
  /** OpenAI API key for newsletter generation. */
  apiKey: z.string().min(1).optional(),
  /** Base URL for the OpenAI-compatible HTTP API. */
  baseUrl: z.string().url().optional(),
  /** Chat completions model id. */
  model: z.string().min(1).optional(),
  /** LLM temperature. */
  temperature: z.number().optional(),
  /** Maximum tokens to generate. */
  maxTokens: z.number().int().positive().optional(),
  /**
   * Per-request timeout in milliseconds passed to the AI SDK `generateObject` call.
   */
  timeoutMs: z.number().int().positive().optional(),
});

const promptsSchema = z.object({
  systemPrompt: z.string().optional(),
  userPromptTemplate: z.string().optional(),
});

const outputSchema = z.object({
  topNewsCount: z.number().int().positive().optional(),
});

const contextSchema = z.object({
  maxCharsPerSource: z.number().int().positive().optional(),
  maxTotalContextChars: z.number().int().positive().optional(),
});

const freshnessSchema = z.object({
  strategy: z.enum(["calendar_day"]).optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch (e) {
        return false;
      }
    })
    .optional(),
});

const persistRetrySchema = z.object({
  maxAttempts: z.number().int().positive().optional(),
  baseDelayMs: z.number().int().positive().optional(),
  maxDelayMs: z.number().int().positive().optional(),
});

/**
 * Runtime config for the content-generation agent, supplied by Hermes on each invocation
 * (from the admin-selected agent config for the pipeline step).
 */
export const ContentGenerationConfigSchema = z
  .object({
    /** OpenAI API key for newsletter generation (legacy). */
    openaiApiKey: z.string().min(1).optional(),
    /**
     * Base URL for the OpenAI-compatible HTTP API (legacy).
     */
    openaiBaseUrl: z.string().url().optional(),
    /**
     * Chat completions **model id** only (legacy).
     */
    openaiModel: z.string().min(1).optional(),
    /**
     * Retry policy for the LLM call.
     */
    llmRetry: llmRetrySchema.default({
      maxAttempts: 3,
      baseDelayMs: 500,
      maxDelayMs: 8000,
      jitter: true,
    }),
    /**
     * OpenAI SDK call options.
     */
    openai: openaiOptionsSchema.default({
      model: "gpt-4o-mini",
      temperature: 0.4,
      timeoutMs: 120000,
    }),
    /**
     * Prompt templates.
     */
    prompts: promptsSchema.default({}),
    /**
     * Output constraints.
     */
    output: outputSchema.default({
      topNewsCount: 3,
    }),
    /**
     * Context constraints.
     */
    context: contextSchema.default({
      maxCharsPerSource: 8000,
      maxTotalContextChars: 100000,
    }),
    /**
     * Freshness strategy.
     */
    freshness: freshnessSchema.default({
      strategy: "calendar_day",
      timezone: "Asia/Jakarta",
    }),
    /**
     * Persistence retry policy.
     */
    persistRetry: persistRetrySchema.default({
      maxAttempts: 2,
      baseDelayMs: 200,
      maxDelayMs: 2000,
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.openaiApiKey && !data.openai?.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OpenAI API key is required",
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
