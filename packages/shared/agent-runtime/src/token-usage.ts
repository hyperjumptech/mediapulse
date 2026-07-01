/**
 * Shared token-usage accumulation for chronicle instrumentation.
 *
 * Agents call an LLM (and sometimes an embedding model) many times per run. The
 * chronicle needs a durable per-run token record, so every agent accumulates
 * usage the same way: pass {@link TokenUsageAccumulator.onUsage} into the
 * AI-SDK-facing helpers, then read {@link TokenUsageAccumulator.totals} when
 * persisting the run.
 */

/** Normalized token usage from a single chat-model call. */
export type NormalizedLlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/** Sink invoked once per chat-model call with its normalized usage. */
export type OnLlmUsage = (usage: NormalizedLlmUsage) => void;

/** Sink invoked once per embedding call with its total token count. */
export type OnEmbeddingUsage = (usage: { totalTokens: number }) => void;

/** Rolled-up token totals for a whole run. */
export type TokenUsageTotals = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  embeddingTokens: number;
  /** Number of chat-model calls that reported usage. */
  calls: number;
};

/** Accumulator threaded through an agent run's LLM/embedding calls. */
export type TokenUsageAccumulator = {
  /** Records usage from one chat-model call. */
  onUsage: OnLlmUsage;
  /** Records total tokens from one embedding call. */
  onEmbeddingUsage: OnEmbeddingUsage;
  /** Returns a snapshot of the accumulated totals. */
  totals: () => TokenUsageTotals;
};

/**
 * AI SDK v6 usage shape (`inputTokens`/`outputTokens`). Optional in mocks and
 * whenever the provider omits usage on the response.
 */
export type AiSdkUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

/**
 * Normalizes AI SDK v6 usage into prompt/completion/total counts.
 *
 * - Important: AI SDK v6 renamed the fields to `inputTokens`/`outputTokens`; this
 *   maps them to the prompt/completion/total names used across the codebase.
 *
 * @param usage - Raw `result.usage` from `generateObject`/`generateText`.
 * @returns Normalized usage, or `undefined` when the provider omits usage.
 */
export const extractLlmUsage = (
  usage: AiSdkUsage | undefined,
): NormalizedLlmUsage | undefined => {
  if (usage === undefined) {
    return undefined;
  }
  const promptTokens = usage.inputTokens ?? 0;
  const completionTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
};

/**
 * Creates a run-scoped token-usage accumulator.
 *
 * `+=` is safe under parallel fan-out (e.g. per-persona or per-round calls)
 * because the event loop is single-threaded, so no locking is required.
 *
 * @returns Accumulator with `onUsage`/`onEmbeddingUsage` sinks and a `totals` reader.
 */
export const createTokenUsageAccumulator = (): TokenUsageAccumulator => {
  const running: TokenUsageTotals = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    embeddingTokens: 0,
    calls: 0,
  };

  return {
    onUsage: (usage) => {
      running.promptTokens += usage.promptTokens;
      running.completionTokens += usage.completionTokens;
      running.totalTokens += usage.totalTokens;
      running.calls += 1;
    },
    onEmbeddingUsage: (usage) => {
      running.embeddingTokens += usage.totalTokens;
    },
    totals: () => ({ ...running }),
  };
};
