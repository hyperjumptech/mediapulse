import { describe, expect, it } from "vitest";

import { tokenize } from "./phrase-link-injector.js";
import {
  buildSourceComparisonText,
  buildWordShingles,
  DEDUP_COMPARISON_CHAR_LIMIT,
  distinctiveAnchorTokens,
  scoreTextAgainstText,
  shingleIntersectionCount,
  shingleJaccardSimilarity,
} from "./text-similarity.js";

describe("buildWordShingles", () => {
  it("builds sliding n-grams of the requested width", () => {
    const shingles = buildWordShingles(["alpha", "bravo", "charlie", "delta"]);

    expect([...shingles]).toEqual([
      "alpha bravo charlie",
      "bravo charlie delta",
    ]);
  });

  it("falls back to a single shingle when the token list is shorter than the width", () => {
    const shingles = buildWordShingles(["alpha", "bravo"]);

    expect([...shingles]).toEqual(["alpha bravo"]);
  });

  it("returns an empty set for no tokens", () => {
    expect(buildWordShingles([]).size).toBe(0);
  });
});

describe("shingleJaccardSimilarity", () => {
  it("returns 1 for identical sets and 0 for disjoint sets", () => {
    const left = new Set(["a b c", "b c d"]);
    const right = new Set(["a b c", "b c d"]);
    const other = new Set(["x y z"]);

    expect(shingleJaccardSimilarity(left, right)).toBe(1);
    expect(shingleJaccardSimilarity(left, other)).toBe(0);
  });

  it("returns 0 when both sets are empty", () => {
    expect(shingleJaccardSimilarity(new Set(), new Set())).toBe(0);
  });
});

describe("shingleIntersectionCount", () => {
  it("counts members present in both sets regardless of argument order", () => {
    const small = new Set(["a", "b"]);
    const large = new Set(["b", "c", "d"]);

    expect(shingleIntersectionCount(small, large)).toBe(1);
    expect(shingleIntersectionCount(large, small)).toBe(1);
  });
});

describe("distinctiveAnchorTokens", () => {
  it("keeps long words and multi-digit figures, dropping short tokens", () => {
    const anchors = distinctiveAnchorTokens([
      "telkomsel",
      "700",
      "5",
      "bid",
      "auction",
    ]);

    expect([...anchors].sort()).toEqual(["700", "auction", "telkomsel"]);
  });
});

describe("scoreTextAgainstText", () => {
  it("scores a probe fully contained in a longer reference near 1", () => {
    const probe = "Kominfo concluded the 700 spectrum auction this week";
    const reference = `Regulator update. ${probe}. Analysts expect handset demand to follow across the archipelago during the second half.`;

    expect(scoreTextAgainstText(probe, reference)).toBeGreaterThan(0.8);
  });

  it("scores unrelated texts at zero", () => {
    const score = scoreTextAgainstText(
      "Coffee subscription volumes climbed in suburban outlets",
      "Regulator approves updated banking capital adequacy framework guidance",
    );

    expect(score).toBe(0);
  });

  it("grounds on shared entity anchors when no word n-grams match", () => {
    const probe = "Telkomsel, Indosat and Axiata won 700 spectrum blocks";
    const reference =
      "Telkomsel, Indosat, dan Axiata memenangkan blok 700 dalam lelang frekuensi";
    const probeShingles = buildWordShingles(tokenize(probe));
    const referenceShingles = buildWordShingles(tokenize(reference));

    expect(shingleIntersectionCount(probeShingles, referenceShingles)).toBe(0);
    expect(scoreTextAgainstText(probe, reference)).toBeGreaterThan(0.5);
  });
});

describe("buildSourceComparisonText", () => {
  it("prefixes the title and bounds the body to the comparison limit", () => {
    const body = "x".repeat(DEDUP_COMPARISON_CHAR_LIMIT + 500);
    const text = buildSourceComparisonText({
      url: "https://example.com/a",
      title: "Headline",
      content: body,
    });

    expect(text.startsWith("Headline\n")).toBe(true);
    expect(text).toHaveLength(
      "Headline\n".length + DEDUP_COMPARISON_CHAR_LIMIT,
    );
  });
});
