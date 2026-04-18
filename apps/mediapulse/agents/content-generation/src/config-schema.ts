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
  /**
   * Per-request timeout in milliseconds passed to the AI SDK `generateObject` call.
   * When omitted, no timeout is applied.
   */
  timeoutMs: z.number().int().positive().optional(),
});

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
  /**
   * Retry policy for the LLM call. When omitted, defaults apply via
   * {@link resolveContentGenerationConfig}.
   */
  llmRetry: llmRetrySchema.optional(),
  /**
   * OpenAI SDK call options (timeout etc.). When omitted, no per-request timeout is applied.
   */
  openai: openaiOptionsSchema.optional(),
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

/**
 * Content-generation config with optional fields resolved to their production defaults.
 * Use {@link resolveContentGenerationConfig} to obtain this from a parsed config.
 */
export type ResolvedContentGenerationConfig = ContentGenerationConfig & {
  llmRetry: ResolvedLlmRetryConfig;
};

/** Production defaults for fields that may be omitted in Hermes config. */
export const contentGenerationConfigDefaults = {
  llmRetry: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 10_000,
    jitter: true,
  },
} as const;

/**
 * Merges Hermes-supplied config with production defaults for optional fields.
 *
 * @param config - Parsed and validated Hermes agent config.
 * @returns Config safe to use at runtime; `llmRetry` is always present.
 */
export function resolveContentGenerationConfig(
  config: ContentGenerationConfig,
): ResolvedContentGenerationConfig {
  const defaults = contentGenerationConfigDefaults.llmRetry;
  return {
    ...config,
    llmRetry: {
      maxAttempts: config.llmRetry?.maxAttempts ?? defaults.maxAttempts,
      baseDelayMs: config.llmRetry?.baseDelayMs ?? defaults.baseDelayMs,
      maxDelayMs: config.llmRetry?.maxDelayMs ?? defaults.maxDelayMs,
      jitter: config.llmRetry?.jitter ?? defaults.jitter,
    },
  };
}
