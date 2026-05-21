/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildDiversityBroadenSystemNudge,
  computeCompositeDiversityScore,
  computeDiversityScore,
  computeLexicalDiversity,
  computeNormalizedEntropy,
  computeSemanticSpread,
  DEFAULT_DIVERSITY_SCORE_WEIGHTS,
  tokenizeQueryText,
} from "./score";

describe("tokenizeQueryText", () => {
  it("lowercases and splits on whitespace", () => {
    expect(tokenizeQueryText("  ABC Latest  News ")).toEqual([
      "abc",
      "latest",
      "news",
    ]);
  });
});

describe("computeLexicalDiversity", () => {
  it("returns a low ratio for many identical texts", () => {
    const rows = Array.from({ length: 10 }, () => ({
      text: "abc latest news",
      intent: "breaking" as const,
    }));
    expect(computeLexicalDiversity(rows)).toBeCloseTo(0.1, 5);
  });

  it("returns 1 when every token is unique within a row and rows differ", () => {
    const rows = [
      { text: "alpha", intent: "breaking" as const },
      { text: "beta", intent: "kg_change" as const },
    ];
    expect(computeLexicalDiversity(rows)).toBe(1);
  });
});

describe("computeNormalizedEntropy", () => {
  it("returns 0 for a single intent", () => {
    expect(computeNormalizedEntropy(["breaking", "breaking"])).toBe(0);
  });

  it("returns 1 for a balanced two-intent split", () => {
    expect(computeNormalizedEntropy(["breaking", "fundamental"])).toBeCloseTo(
      1,
      5,
    );
  });
});

describe("computeSemanticSpread", () => {
  it("returns 0 for fewer than two embeddings", () => {
    expect(computeSemanticSpread([[1, 0]])).toBe(0);
  });

  it("returns higher spread for orthogonal unit vectors", () => {
    const spread = computeSemanticSpread([
      [1, 0],
      [0, 1],
    ]);
    expect(spread).toBeCloseTo(1, 5);
  });
});

describe("computeCompositeDiversityScore", () => {
  it("renormalizes weights when semantic axis is omitted", () => {
    const composite = computeCompositeDiversityScore(
      { lexicalDiversity: 1, intentCoverage: 0 },
      DEFAULT_DIVERSITY_SCORE_WEIGHTS,
    );
    expect(composite).toBeCloseTo(0.4 / 0.7, 5);
  });
});

describe("computeDiversityScore", () => {
  it("scores identical texts with low lexical and intent coverage", () => {
    const rows = Array.from({ length: 10 }, () => ({
      text: "ABC latest news",
      intent: "breaking" as const,
    }));
    const score = computeDiversityScore(rows);
    expect(score.lexicalDiversity).toBeCloseTo(0.1, 5);
    expect(score.intentCoverage).toBe(0);
    expect(score.composite).toBeLessThan(0.2);
  });

  it("scores a varied set at or above 0.8", () => {
    const intents = [
      "breaking",
      "kg_change",
      "fundamental",
      "sentiment",
      "competitor",
      "supply_chain",
      "esg",
      "macro",
      "technical",
      "breaking",
    ] as const;
    const personas = ["analyst", "retail", "regulator"] as const;
    const rows = intents.map((intent, index) => ({
      text: `token${String(index)}a token${String(index)}b token${String(index)}c`,
      intent,
      persona: personas[index % personas.length]!,
    }));
    const score = computeDiversityScore(rows);
    expect(score.composite).toBeGreaterThanOrEqual(0.8);
    expect(score.personaCoverage).toBeGreaterThan(0);
  });
});

describe("buildDiversityBroadenSystemNudge", () => {
  it("includes composite breakdown and broaden instruction", () => {
    const nudge = buildDiversityBroadenSystemNudge({
      lexicalDiversity: 0.1,
      intentCoverage: 0,
      composite: 0.04,
    });
    expect(nudge).toContain("low on diversity");
    expect(nudge).toContain("lexical=0.10");
    expect(nudge).toContain("Vary phrasing");
  });
});
