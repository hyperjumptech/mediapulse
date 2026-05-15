/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildQueryAnalysisSystemContent,
  buildQueryAnalysisUserContent,
  fetchLlmQueryCandidates,
  resolveQueryAnalysisSystemContent,
  resolveQueryAnalysisUserContent,
} from "./llm-queries";

describe("resolveQueryAnalysisSystemContent", () => {
  it("matches buildQueryAnalysisSystemContent when Hermes omits override", () => {
    const strategy = {
      queryCount: 10,
      allowedLanguages: ["en", "de"],
      minDeterministicCount: 3,
      weights: { breaking: 1, kgChange: 1, fundamental: 1 } as const,
    };

    const resolved = resolveQueryAnalysisSystemContent(undefined, strategy);
    const legacy = buildQueryAnalysisSystemContent(strategy);

    expect(resolved).toBe(legacy);
  });
});

describe("resolveQueryAnalysisUserContent", () => {
  it("matches buildQueryAnalysisUserContent when Hermes omits override", () => {
    const ctx = {
      ticker: {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "ACME",
        name: "Acme Co",
        metadata: null,
      },
      topEntities: [] as {
        canonicalName: string;
        typeName: string;
        relevanceWeight: number;
      }[],
      recentThemes: [] as { theme: string; articleCount: number }[],
      recentRelationDeltas: [] as {
        fromEntity: string;
        toEntity: string;
        relationType: string;
        change: "added";
      }[],
    };

    const resolved = resolveQueryAnalysisUserContent(undefined, ctx);
    const legacy = buildQueryAnalysisUserContent(ctx);
    expect(resolved).toBe(legacy);
  });

  it("wraps context with a custom user template", () => {
    const ctx = {
      ticker: {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "SYM",
        name: "N",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
      recentRelationDeltas: [],
    };
    const text = resolveQueryAnalysisUserContent(
      "START\n{{queryContextBlock}}\nEND",
      ctx,
    );
    expect(text.startsWith("START\n")).toBe(true);
    expect(text).toContain("SYM");
    expect(text.endsWith("END")).toBe(true);
  });
});

describe("buildQueryAnalysisSystemContent", () => {
  it("includes languages, intent mix hints, and schema instructions", () => {
    // Act
    const text = buildQueryAnalysisSystemContent({
      queryCount: 10,
      allowedLanguages: ["en", "de"],
      minDeterministicCount: 3,
      weights: { breaking: 1, kgChange: 1, fundamental: 1 },
    });

    // Assert
    expect(text).toContain("en, de");
    expect(text).toContain("kg_change");
    expect(text).toContain("3");
    expect(text).toContain('"queries"');
  });
});

describe("buildQueryAnalysisUserContent", () => {
  it("includes ticker, entities, themes, and relation deltas", () => {
    // Setup
    const ctx = {
      ticker: {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "ACME",
        name: "Acme Co",
        metadata: null,
      },
      topEntities: [
        {
          canonicalName: "Subsidiary",
          typeName: "Organization",
          relevanceWeight: 0.9,
        },
      ],
      recentThemes: [{ theme: "AI", articleCount: 3 }],
      recentRelationDeltas: [
        {
          fromEntity: "A",
          toEntity: "B",
          relationType: "owns",
          change: "added" as const,
        },
      ],
    };

    // Act
    const text = buildQueryAnalysisUserContent(ctx);

    // Assert
    expect(text).toContain("ACME");
    expect(text).toContain("Acme Co");
    expect(text).toContain("Subsidiary");
    expect(text).toContain("AI");
    expect(text).toContain("owns");
  });
});

describe("fetchLlmQueryCandidates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns trimmed non-empty rows from generateObject", async () => {
    // Setup
    const generateObjectForQueries = vi.fn().mockResolvedValue({
      object: {
        queries: [
          { text: "  ok  ", intent: "breaking" },
          { text: "   ", intent: "fundamental" },
        ],
      },
    });

    // Act
    const rows = await fetchLlmQueryCandidates(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 100,
        messages: [{ role: "user", content: "hi" }],
      },
      { generateObjectForQueries },
    );

    // Assert
    expect(rows).toEqual([{ text: "ok", intent: "breaking" }]);
    expect(generateObjectForQueries).toHaveBeenCalledTimes(1);
  });

  it("propagates generateObject errors to the caller", async () => {
    const generateObjectForQueries = vi
      .fn()
      .mockRejectedValue(new Error("api down"));

    await expect(
      fetchLlmQueryCandidates(
        {
          apiKey: "sk-test",
          model: "gpt-4o-mini",
          maxOutputTokens: 100,
          messages: [{ role: "user", content: "hi" }],
        },
        { generateObjectForQueries },
      ),
    ).rejects.toThrow("api down");
  });
});
