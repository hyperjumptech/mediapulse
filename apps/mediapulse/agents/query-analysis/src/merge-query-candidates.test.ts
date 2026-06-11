/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

import {
  appendWildcardRowsToMerged,
  applySectionCoverageReserve,
  dedupeDeterministic,
  dedupeLlmAgainstKeys,
  effectiveMergeWeight,
  finalizeWildcardCandidates,
  intentMergeWeight,
  mergeQueryCandidates,
  normalizeQueryKey,
  orderLlmRowsByPersonaRoundRobin,
  sortPoolByIntentWeight,
  yieldMergeMultiplier,
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

describe("finalizeWildcardCandidates", () => {
  it("retries once when dedupe drops wildcard rows", async () => {
    const seenKeys = new Set<string>(["duplicate query"]);
    const retryFetch = vi
      .fn()
      .mockResolvedValue([
        { text: "Fresh lateral angle", intent: "wildcard" as const },
      ]);

    const accepted = await finalizeWildcardCandidates({
      wildcards: [
        { text: "Duplicate query", intent: "wildcard" },
        { text: "Unique wildcard", intent: "wildcard" },
      ],
      seenKeys,
      wildcardCount: 2,
      retryFetch,
    });

    expect(accepted).toEqual([
      { text: "Unique wildcard", intent: "wildcard", source: "llm" },
      { text: "Fresh lateral angle", intent: "wildcard", source: "llm" },
    ]);
    expect(retryFetch).toHaveBeenCalledTimes(1);
  });
});

describe("appendWildcardRowsToMerged", () => {
  it("appends wildcard rows and reassigns ranks up to queryCount", () => {
    const merged = appendWildcardRowsToMerged(
      [
        {
          text: "standard",
          source: "llm",
          intent: "breaking",
          rank: 1,
        },
      ],
      [
        {
          text: "wildcard one",
          intent: "wildcard",
          source: "llm",
        },
      ],
      2,
    );

    expect(merged).toEqual([
      {
        text: "standard",
        source: "llm",
        intent: "breaking",
        rank: 1,
      },
      {
        text: "wildcard one",
        source: "llm",
        intent: "wildcard",
        rank: 2,
      },
    ]);
  });
});

describe("yieldMergeMultiplier", () => {
  it("returns 1 when prior yield is absent", () => {
    expect(
      yieldMergeMultiplier({
        intent: "fundamental",
        templateId: "{name} earnings guidance",
      }),
    ).toBe(1);
  });

  it("prefers template-level novel yield over intent fallback", () => {
    const priorYield = {
      perTemplate: [
        {
          templateId: "{name} earnings guidance",
          avgArticles: 2,
          avgNovel: 3,
        },
      ],
      perIntent: [
        { intent: "fundamental" as const, avgArticles: 0.2, avgNovel: 0.1 },
      ],
      perPersona: [],
    };
    expect(
      yieldMergeMultiplier({
        intent: "fundamental",
        templateId: "{name} earnings guidance",
        priorYield,
      }),
    ).toBeCloseTo(1 + Math.log(1 + 3));
  });
});

describe("mergeQueryCandidates with priorYield", () => {
  it("ranks high-novel-yield templates above same-intent peers", () => {
    const weights = {
      ...baseWeights,
      fundamental: 0.6,
    };
    const priorYield = {
      perTemplate: [
        {
          templateId: "low-yield-template",
          avgArticles: 0.1,
          avgNovel: 0.01,
        },
        {
          templateId: "high-yield-template",
          avgArticles: 3,
          avgNovel: 2.5,
        },
      ],
      perIntent: [],
      perPersona: [],
    };
    const withoutYield = mergeQueryCandidates({
      deterministic: [
        {
          text: "d-low",
          intent: "fundamental",
          templateId: "low-yield-template",
        },
        {
          text: "d-high",
          intent: "fundamental",
          templateId: "high-yield-template",
        },
      ],
      llm: [],
      queryCount: 2,
      minDeterministicCount: 0,
      weights,
    });
    const withYield = mergeQueryCandidates({
      deterministic: [
        {
          text: "d-low",
          intent: "fundamental",
          templateId: "low-yield-template",
        },
        {
          text: "d-high",
          intent: "fundamental",
          templateId: "high-yield-template",
        },
      ],
      llm: [],
      queryCount: 2,
      minDeterministicCount: 0,
      weights,
      priorYield,
    });

    expect(withoutYield.map((row) => row.text)).toEqual(["d-low", "d-high"]);
    expect(withYield.map((row) => row.text)).toEqual(["d-high", "d-low"]);
    expect(
      effectiveMergeWeight({
        intent: "fundamental",
        weights,
        templateId: "high-yield-template",
        priorYield,
      }),
    ).toBeGreaterThan(
      effectiveMergeWeight({
        intent: "fundamental",
        weights,
        templateId: "low-yield-template",
        priorYield,
      }),
    );
  });
});

describe("applySectionCoverageReserve", () => {
  it("promotes a competitor deterministic candidate when no competitor row survived merge", () => {
    // No competitor or technology_trend rows in the merged set.
    const merged = [
      {
        text: "breaking one",
        source: "deterministic" as const,
        intent: "breaking" as const,
        rank: 1,
      },
      {
        text: "breaking two",
        source: "deterministic" as const,
        intent: "breaking" as const,
        rank: 2,
      },
      {
        text: "macro one",
        source: "llm" as const,
        intent: "macro" as const,
        rank: 3,
      },
    ];
    // Deterministic pool contains a competitor candidate.
    const deterministic = [
      { text: "breaking one", intent: "breaking" as const },
      { text: "industry competitive landscape", intent: "competitor" as const },
    ];

    const adjusted = applySectionCoverageReserve(merged, deterministic, 3);

    // Total count must not exceed queryCount.
    expect(adjusted).toHaveLength(3);

    // A competitor-intent row must appear in the output.
    const competitorRow = adjusted.find((row) => row.intent === "competitor");
    expect(competitorRow).toBeDefined();
  });

  it("promotes a technology_trend deterministic candidate when disruptorsOrTech has zero coverage", () => {
    const merged = [
      {
        text: "breaking one",
        source: "deterministic" as const,
        intent: "breaking" as const,
        rank: 1,
      },
      {
        text: "breaking two",
        source: "deterministic" as const,
        intent: "breaking" as const,
        rank: 2,
      },
      {
        text: "breaking three",
        source: "llm" as const,
        intent: "breaking" as const,
        rank: 3,
      },
    ];
    const deterministic = [
      { text: "breaking one", intent: "breaking" as const },
      {
        text: "industry technology disruption",
        intent: "technology_trend" as const,
      },
    ];

    const adjusted = applySectionCoverageReserve(merged, deterministic, 3);

    expect(adjusted).toHaveLength(3);
    const techRow = adjusted.find(
      (row) => row.intent === "technology_trend" || row.intent === "technical",
    );
    expect(techRow).toBeDefined();
  });

  it("keeps total row count at queryCount after promoting a reserve", () => {
    const queryCount = 4;
    const merged = [
      {
        text: "a",
        source: "deterministic" as const,
        intent: "breaking" as const,
        rank: 1,
      },
      {
        text: "b",
        source: "llm" as const,
        intent: "breaking" as const,
        rank: 2,
      },
      { text: "c", source: "llm" as const, intent: "macro" as const, rank: 3 },
      {
        text: "d",
        source: "llm" as const,
        intent: "sentiment" as const,
        rank: 4,
      },
    ];
    const deterministic = [
      { text: "a", intent: "breaking" as const },
      { text: "sector competitive landscape", intent: "competitor" as const },
    ];

    const adjusted = applySectionCoverageReserve(
      merged,
      deterministic,
      queryCount,
    );

    expect(adjusted).toHaveLength(queryCount);
  });

  it("returns unchanged rows when all dedicated-intent sections already have coverage", () => {
    // competitor, regulatory, technology_trend, industry_trend, deals all covered.
    const merged = [
      {
        text: "peer threats",
        source: "llm" as const,
        intent: "competitor" as const,
        rank: 1,
      },
      {
        text: "compliance news",
        source: "llm" as const,
        intent: "regulatory" as const,
        rank: 2,
      },
      {
        text: "ai disruption",
        source: "llm" as const,
        intent: "technology_trend" as const,
        rank: 3,
      },
      {
        text: "sector outlook",
        source: "llm" as const,
        intent: "industry_trend" as const,
        rank: 4,
      },
      {
        text: "merger deal",
        source: "llm" as const,
        intent: "deals" as const,
        rank: 5,
      },
    ];
    const deterministic: { text: string; intent: "breaking" }[] = [];

    const adjusted = applySectionCoverageReserve(merged, deterministic, 5);

    expect(adjusted.map((row) => row.text)).toEqual(
      merged.map((row) => row.text),
    );
  });

  it("assigns contiguous ranks starting at 1 after adjustment", () => {
    const merged = [
      {
        text: "breaking one",
        source: "deterministic" as const,
        intent: "breaking" as const,
        rank: 1,
      },
      {
        text: "breaking two",
        source: "deterministic" as const,
        intent: "breaking" as const,
        rank: 2,
      },
    ];
    const deterministic = [
      { text: "competitor query", intent: "competitor" as const },
    ];

    const adjusted = applySectionCoverageReserve(merged, deterministic, 2);

    expect(adjusted.map((row) => row.rank)).toEqual(
      Array.from({ length: adjusted.length }, (_, i) => i + 1),
    );
  });
});
