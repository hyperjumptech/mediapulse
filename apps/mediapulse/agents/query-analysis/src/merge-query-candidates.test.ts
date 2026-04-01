/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { QueryCandidate } from "./deterministic-baseline.js";
import { mergeAndRankCandidates } from "./merge-query-candidates.js";

const config = {
  queryCount: 4,
  allowedLanguages: ["en"],
  minDeterministicCount: 3,
  weightBreaking: 0.5,
  weightKgChange: 0.3,
  weightFundamental: 0.2,
  model: "gpt-4o-mini",
  maxTokens: 500,
};

describe("mergeAndRankCandidates", () => {
  it("prefers deterministic text when LLM duplicates the same normalized key", () => {
    const baseline: QueryCandidate[] = [
      {
        text: "AAPL news",
        source: "deterministic",
        intent: "breaking",
        rank: 0,
      },
    ];
    const llm: QueryCandidate[] = [
      {
        text: "  aapl   NEWS ",
        source: "llm",
        intent: "fundamental",
        rank: 0,
      },
    ];

    const out = mergeAndRankCandidates(baseline, llm, config);

    expect(out).toHaveLength(1);
    expect(out[0]?.source).toBe("deterministic");
    expect(out[0]?.rank).toBe(0);
  });

  it("caps results at queryCount with breaking intent ordered first", () => {
    const baseline: QueryCandidate[] = [
      {
        text: "b1",
        source: "deterministic",
        intent: "fundamental",
        rank: 0,
      },
      {
        text: "b2",
        source: "deterministic",
        intent: "breaking",
        rank: 1,
      },
    ];
    const llm: QueryCandidate[] = [
      {
        text: "l1",
        source: "llm",
        intent: "breaking",
        rank: 0,
      },
    ];

    const out = mergeAndRankCandidates(baseline, llm, {
      ...config,
      queryCount: 2,
    });

    expect(out).toHaveLength(2);
    expect(out[0]?.intent).toBe("breaking");
    expect(out[1]?.rank).toBe(1);
  });
});
