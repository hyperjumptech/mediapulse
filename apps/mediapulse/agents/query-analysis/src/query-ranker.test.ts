import { describe, expect, it } from "vitest";
import { rankAndTrim } from "./query-ranker.js";
import type { RawCandidate } from "./query-ranker.js";

const makeCandidate = (
  text: string,
  intent: RawCandidate["intent"],
  source: RawCandidate["source"] = "llm",
): RawCandidate => ({ text, intent, source });

describe("rankAndTrim", () => {
  const weights = { breaking: 3, kg_change: 2, fundamental: 1 };

  it("returns at most queryCount items", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate(`query ${i}`, "breaking"),
    );
    const result = rankAndTrim(candidates, { queryCount: 5, weights });

    expect(result).toHaveLength(5);
  });

  it("assigns 1-based ranks", () => {
    const candidates = [
      makeCandidate("a", "breaking"),
      makeCandidate("b", "fundamental"),
      makeCandidate("c", "kg_change"),
    ];
    const result = rankAndTrim(candidates, { queryCount: 10, weights });

    const ranks = result.map((r) => r.rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3]);
  });

  it("sorts breaking > kg_change > fundamental by weight", () => {
    const candidates = [
      makeCandidate("fund query", "fundamental"),
      makeCandidate("break query", "breaking"),
      makeCandidate("kg query",   "kg_change"),
    ];
    const result = rankAndTrim(candidates, { queryCount: 10, weights });

    expect(result[0]!.intent).toBe("breaking");
    expect(result[1]!.intent).toBe("kg_change");
    expect(result[2]!.intent).toBe("fundamental");
  });

  it("prefers deterministic over llm when intent weight is equal", () => {
    const candidates = [
      makeCandidate("llm breaking",   "breaking", "llm"),
      makeCandidate("det breaking",   "breaking", "deterministic"),
    ];
    const result = rankAndTrim(candidates, { queryCount: 10, weights });

    expect(result[0]!.source).toBe("deterministic");
  });

  it("deduplicates on normalised text (case-insensitive, trimmed)", () => {
    const candidates = [
      makeCandidate("AAPL Latest News", "breaking"),
      makeCandidate("aapl latest news", "breaking"),
      makeCandidate("  AAPL Latest News  ", "kg_change"),
    ];
    const result = rankAndTrim(candidates, { queryCount: 10, weights });

    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("AAPL Latest News");
  });

  it("preserves all candidates when fewer than queryCount", () => {
    const candidates = [
      makeCandidate("a", "breaking"),
      makeCandidate("b", "fundamental"),
    ];
    const result = rankAndTrim(candidates, { queryCount: 10, weights });

    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(rankAndTrim([], { queryCount: 10, weights })).toEqual([]);
  });
});
