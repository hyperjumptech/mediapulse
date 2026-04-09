/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";

import {
  dedupeDeterministic,
  dedupeLlmAgainstKeys,
  intentMergeWeight,
  mergeQueryCandidates,
  normalizeQueryKey,
} from "./merge-query-candidates";

describe("normalizeQueryKey", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    // Act
    const key = normalizeQueryKey("  Foo   Bar\t");

    // Assert
    expect(key).toBe("foo bar");
  });
});

describe("intentMergeWeight", () => {
  it("returns the configured weight for each intent", () => {
    const w = { breaking: 1, kgChange: 0.5, fundamental: 0.25 };
    expect(intentMergeWeight("breaking", w)).toBe(1);
    expect(intentMergeWeight("kg_change", w)).toBe(0.5);
    expect(intentMergeWeight("fundamental", w)).toBe(0.25);
  });
});

describe("dedupeDeterministic", () => {
  it("drops empty strings and duplicate keys", () => {
    // Act
    const out = dedupeDeterministic([
      { text: "  ", intent: "breaking" },
      { text: "AAPL news", intent: "breaking" },
      { text: "aapl  news", intent: "fundamental" },
      { text: "Unique", intent: "kg_change" },
    ]);

    // Assert
    expect(out).toEqual([
      { text: "AAPL news", intent: "breaking" },
      { text: "Unique", intent: "kg_change" },
    ]);
  });
});

describe("dedupeLlmAgainstKeys", () => {
  it("skips rows whose key already exists", () => {
    // Setup
    const seen = new Set<string>(["dup"]);

    // Act
    const out = dedupeLlmAgainstKeys(
      [
        { text: "Dup", intent: "breaking" },
        { text: "New", intent: "fundamental" },
      ],
      seen,
    );

    // Assert
    expect(out).toEqual([
      { text: "New", intent: "fundamental", source: "llm" },
    ]);
    expect(seen.has("new")).toBe(true);
  });
});

describe("mergeQueryCandidates", () => {
  afterEach(() => {
    // no mocks
  });

  it("assigns contiguous ranks and respects queryCount", () => {
    const weights = { breaking: 1, kgChange: 0.8, fundamental: 0.6 };
    const det = [
      { text: "a", intent: "breaking" as const },
      { text: "b", intent: "kg_change" as const },
    ];
    const merged = mergeQueryCandidates({
      deterministic: det,
      llm: [{ text: "c", intent: "fundamental" }],
      queryCount: 2,
      minDeterministicCount: 1,
      weights,
    });

    expect(merged).toHaveLength(2);
    expect(merged.map((m) => m.rank)).toEqual([1, 2]);
  });

  it("keeps a deterministic floor up to queryCount", () => {
    const weights = { breaking: 1, kgChange: 0.8, fundamental: 0.6 };
    const det = [
      { text: "d1", intent: "breaking" as const },
      { text: "d2", intent: "breaking" as const },
      { text: "d3", intent: "breaking" as const },
    ];
    const merged = mergeQueryCandidates({
      deterministic: det,
      llm: [{ text: "l1", intent: "fundamental" }],
      queryCount: 2,
      minDeterministicCount: 2,
      weights,
    });

    expect(merged).toHaveLength(2);
    expect(merged.every((m) => m.source === "deterministic")).toBe(true);
  });

  it("orders the tail by higher intent weight first when trimming pool", () => {
    const weights = { breaking: 1, kgChange: 0.8, fundamental: 0.6 };
    const det = [
      { text: "d1", intent: "fundamental" as const },
      { text: "d2", intent: "kg_change" as const },
    ];
    const merged = mergeQueryCandidates({
      deterministic: det,
      llm: [
        { text: "l1", intent: "fundamental" },
        { text: "l2", intent: "breaking" },
      ],
      queryCount: 3,
      minDeterministicCount: 1,
      weights,
    });

    expect(merged).toHaveLength(3);
    expect(merged[0]?.source).toBe("deterministic");
    expect(merged[1]?.text).toBe("l2");
    expect(merged[2]?.text).toBe("d2");
  });
});
