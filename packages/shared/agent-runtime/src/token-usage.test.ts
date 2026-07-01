import { describe, expect, it } from "vitest";

import { createTokenUsageAccumulator, extractLlmUsage } from "./token-usage.js";

describe("extractLlmUsage", () => {
  it("normalizes AI SDK v6 input/output tokens to prompt/completion/total", () => {
    expect(
      extractLlmUsage({ inputTokens: 100, outputTokens: 40, totalTokens: 140 }),
    ).toEqual({ promptTokens: 100, completionTokens: 40, totalTokens: 140 });
  });

  it("derives totalTokens from input + output when total is absent", () => {
    expect(extractLlmUsage({ inputTokens: 100, outputTokens: 40 })).toEqual({
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
    });
  });

  it("returns undefined when usage is absent", () => {
    expect(extractLlmUsage(undefined)).toBeUndefined();
  });
});

describe("createTokenUsageAccumulator", () => {
  it("sums chat-model usage across calls and counts them", () => {
    const accumulator = createTokenUsageAccumulator();
    accumulator.onUsage({
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
    });
    accumulator.onUsage({
      promptTokens: 50,
      completionTokens: 10,
      totalTokens: 60,
    });

    expect(accumulator.totals()).toEqual({
      promptTokens: 150,
      completionTokens: 50,
      totalTokens: 200,
      embeddingTokens: 0,
      calls: 2,
    });
  });

  it("accumulates embedding tokens separately without incrementing call count", () => {
    const accumulator = createTokenUsageAccumulator();
    accumulator.onEmbeddingUsage({ totalTokens: 512 });
    accumulator.onEmbeddingUsage({ totalTokens: 128 });

    const totals = accumulator.totals();

    expect(totals.embeddingTokens).toBe(640);
    expect(totals.calls).toBe(0);
  });

  it("returns an independent snapshot from totals()", () => {
    const accumulator = createTokenUsageAccumulator();
    accumulator.onUsage({
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
    });
    const snapshot = accumulator.totals();
    accumulator.onUsage({
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
    });

    expect(snapshot.totalTokens).toBe(2);
  });
});
