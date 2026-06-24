/** @vitest-environment node */

import type { generateObject } from "ai";
import { describe, expect, it } from "vitest";

import { judgeRelevance, type JudgeRelevanceInput } from "./judge-relevance";

const baseInput = (
  overrides: Partial<JudgeRelevanceInput> = {},
): JudgeRelevanceInput => ({
  title: "Apple earnings beat expectations",
  content: "AAPL reported strong quarterly results today.",
  tickerSymbol: "AAPL",
  tickerName: "Apple Inc.",
  tickerAliases: ["aapl", "apple"],
  industryAliases: ["technology"],
  llm: { apiKey: "k", model: "m", baseUrl: "" },
  ...overrides,
});

const fakeGenerate = (relevant: boolean): typeof generateObject =>
  (async () => ({
    object: { relevant, reason: "test" },
  })) as unknown as typeof generateObject;

describe("judgeRelevance", () => {
  it("uses the keyword fallback when no contract brief is present", async () => {
    let called = false;
    const generate = (async () => {
      called = true;
      return { object: { relevant: true, reason: "t" } };
    }) as unknown as typeof generateObject;

    const decision = await judgeRelevance(baseInput({ generate }));

    expect(decision).toEqual({ keep: true, via: "keyword" });
    expect(called).toBe(false);
  });

  it("drops via keyword fallback when no alias is mentioned", async () => {
    const decision = await judgeRelevance(
      baseInput({
        title: "Unrelated cooking blog",
        content: "A recipe for banana bread.",
      }),
    );

    expect(decision).toEqual({
      keep: false,
      reason: "irrelevant",
      via: "keyword",
    });
  });

  it("keeps when the LLM judges relevant", async () => {
    const decision = await judgeRelevance(
      baseInput({
        contractBrief: "Track AAPL news.",
        generate: fakeGenerate(true),
      }),
    );

    expect(decision).toEqual({ keep: true, via: "llm" });
  });

  it("drops when the LLM judges not relevant", async () => {
    const decision = await judgeRelevance(
      baseInput({
        contractBrief: "Track AAPL news.",
        generate: fakeGenerate(false),
      }),
    );

    expect(decision).toEqual({ keep: false, reason: "irrelevant", via: "llm" });
  });

  it("falls back to keyword matching when the LLM call throws", async () => {
    const generate = (async () => {
      throw new Error("llm down");
    }) as unknown as typeof generateObject;

    const decision = await judgeRelevance(
      baseInput({ contractBrief: "Track AAPL news.", generate }),
    );

    expect(decision).toEqual({ keep: true, via: "keyword" });
  });
});
