/** @vitest-environment node */
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

import {
  dedupeDeterministic,
  dedupeLlmAgainstKeys,
  intentMergeWeight,
  mergeQueryCandidates,
  normalizeQueryKey,
  orderLlmRowsByPersonaRoundRobin,
  sortPoolByIntentWeight,
} from "./merge-query-candidates";

const baseWeights = DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS;

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
    const w = {
      ...baseWeights,
      breaking: 1,
      kg_change: 0.5,
      fundamental: 0.25,
    };
    expect(intentMergeWeight("breaking", w)).toBe(1);
    expect(intentMergeWeight("kg_change", w)).toBe(0.5);
    expect(intentMergeWeight("fundamental", w)).toBe(0.25);
    expect(intentMergeWeight("esg", w)).toBe(baseWeights.esg);
  });

  it("returns 0 for intents missing from the weight record", () => {
    expect(intentMergeWeight("esg", {} as typeof baseWeights)).toBe(0);
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
    const weights = {
      ...baseWeights,
      breaking: 1,
      kg_change: 0.8,
      fundamental: 0.6,
    };
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
    const weights = {
      ...baseWeights,
      breaking: 1,
      kg_change: 0.8,
      fundamental: 0.6,
    };
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
    const weights = {
      ...baseWeights,
      breaking: 1,
      kg_change: 0.8,
      fundamental: 0.6,
    };
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

  it("round-robins persona-tagged LLM rows after the deterministic floor", () => {
    const weights = {
      ...baseWeights,
      breaking: 1,
      kg_change: 0.8,
      fundamental: 0.6,
    };
    const det = [
      { text: "d1", intent: "breaking" as const },
      { text: "d2", intent: "breaking" as const },
    ];
    const llm = [
      { text: "a1", intent: "breaking" as const, persona: "persona-a" },
      { text: "a2", intent: "breaking" as const, persona: "persona-a" },
      { text: "a3", intent: "breaking" as const, persona: "persona-a" },
      { text: "b1", intent: "breaking" as const, persona: "persona-b" },
      { text: "b2", intent: "breaking" as const, persona: "persona-b" },
      { text: "b3", intent: "breaking" as const, persona: "persona-b" },
      { text: "c1", intent: "breaking" as const, persona: "persona-c" },
      { text: "c2", intent: "breaking" as const, persona: "persona-c" },
      { text: "c3", intent: "breaking" as const, persona: "persona-c" },
    ];
    const merged = mergeQueryCandidates({
      deterministic: det,
      llm,
      queryCount: 11,
      minDeterministicCount: 2,
      weights,
    });

    expect(merged).toHaveLength(11);
    expect(
      merged.slice(0, 2).every((row) => row.source === "deterministic"),
    ).toBe(true);
    expect(merged.slice(2).map((row) => row.persona)).toEqual([
      "persona-a",
      "persona-b",
      "persona-c",
      "persona-a",
      "persona-b",
      "persona-c",
      "persona-a",
      "persona-b",
      "persona-c",
    ]);
  });
});

describe("orderLlmRowsByPersonaRoundRobin", () => {
  it("interleaves rows by first-seen persona order", () => {
    const ordered = orderLlmRowsByPersonaRoundRobin([
      { text: "a1", intent: "breaking", source: "llm", persona: "a" },
      { text: "b1", intent: "breaking", source: "llm", persona: "b" },
      { text: "a2", intent: "breaking", source: "llm", persona: "a" },
      { text: "b2", intent: "breaking", source: "llm", persona: "b" },
    ]);
    expect(ordered.map((row) => row.text)).toEqual(["a1", "b1", "a2", "b2"]);
  });
});

describe("sortPoolByIntentWeight", () => {
  it("orders rows by descending intent weight", () => {
    const weights = {
      ...baseWeights,
      breaking: 1,
      kg_change: 0.5,
      fundamental: 0.25,
    };
    const sorted = sortPoolByIntentWeight(
      [
        {
          row: { text: "fund", intent: "fundamental", source: "deterministic" },
          index: 0,
        },
        {
          row: { text: "break", intent: "breaking", source: "deterministic" },
          index: 1,
        },
      ],
      weights,
    );
    expect(sorted.map((row) => row.text)).toEqual(["break", "fund"]);
  });
});
