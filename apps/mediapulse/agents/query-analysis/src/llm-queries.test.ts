/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBrainstormPrompt,
  buildQueryAnalysisSystemContent,
  buildQueryAnalysisUserContent,
  buildStructuredQueryMessages,
  fetchBrainstormBullets,
  fetchLlmQueryCandidates,
  fetchQueryAnalysisLlmCandidates,
  parseBrainstormBullets,
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

const emptyEnrichedContext = {
  peers: [] as [],
  calendar: { recentEventTypes: [] as string[] },
  headlineSamples: [] as [],
  kgNeighborhood: [] as [],
};

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
      ...emptyEnrichedContext,
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
      ...emptyEnrichedContext,
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
      peers: [{ symbol: "PEER1", name: "Peer One", relevance: 0.9 }],
      calendar: {
        nextEarningsAt: "2026-07-22T00:00:00.000Z",
        recentEventTypes: ["ratings_change"],
      },
      headlineSamples: [
        {
          title: "Acme beats estimates",
          publishedAt: "2026-05-18T08:00:00.000Z",
          sourceName: "reuters.com",
        },
      ],
      kgNeighborhood: [
        {
          fromEntity: "Subsidiary",
          relationType: "PARTNER_OF",
          toEntity: "Vendor",
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
    expect(text).toContain("Sector peers:");
    expect(text).toContain("PEER1");
    expect(text).toContain("Next earnings: 2026-07-22T00:00:00.000Z");
    expect(text).toContain("Recent headlines:");
    expect(text).toContain("reuters.com");
    expect(text).toContain("KG neighborhood:");
    expect(text).toContain("PARTNER_OF");
  });

  it("omits empty enriched blocks from the user prompt", () => {
    const text = buildQueryAnalysisUserContent({
      ticker: {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "ACME",
        name: "Acme Co",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
      ...emptyEnrichedContext,
    });

    expect(text).not.toContain("Sector peers:");
    expect(text).not.toContain("Calendar:");
    expect(text).not.toContain("Recent headlines:");
    expect(text).not.toContain("KG neighborhood:");
  });
});

describe("parseBrainstormBullets", () => {
  it("strips list prefixes and empty lines", () => {
    const bullets = parseBrainstormBullets(
      "- first angle\n\n2. second angle\n* third angle",
    );
    expect(bullets).toEqual(["first angle", "second angle", "third angle"]);
  });
});

describe("buildBrainstormPrompt", () => {
  it("includes serialized context in the user message", () => {
    const ctx = {
      ticker: {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "ACME",
        name: "Acme Co",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
      ...emptyEnrichedContext,
    };
    const prompt = buildBrainstormPrompt(
      {
        queryCount: 10,
        allowedLanguages: ["en"],
        minDeterministicCount: 4,
        weights: { breaking: 1, kgChange: 0.8, fundamental: 0.6 },
      },
      ctx,
    );
    expect(prompt.system).toContain("12–20");
    expect(prompt.user).toContain("ACME");
  });
});

describe("buildStructuredQueryMessages", () => {
  it("injects few-shot exemplar turns before the live user message", () => {
    const messages = buildStructuredQueryMessages({
      systemContent: "system",
      userContent: "live context",
      fewShotExemplarCount: 2,
    });
    expect(messages[0]?.role).toBe("system");
    expect(messages.filter((m) => m.role === "user")).toHaveLength(3);
    expect(messages.at(-1)).toEqual({ role: "user", content: "live context" });
  });

  it("appends brainstorm bullets to the final user message", () => {
    const messages = buildStructuredQueryMessages({
      systemContent: "system",
      userContent: "live context",
      fewShotExemplarCount: 0,
      brainstormBullets: ["angle one", "angle two"],
    });
    const finalUser = messages.at(-1);
    expect(finalUser?.content).toContain("previously brainstormed");
    expect(finalUser?.content).toContain("angle one");
  });
});

describe("fetchBrainstormBullets", () => {
  it("parses generateText output into bullet strings", async () => {
    const generateTextForBrainstorm = vi.fn().mockResolvedValue({
      text: "- margin outlook\n- peer comparison",
    });
    const bullets = await fetchBrainstormBullets(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 200,
        strategy: {
          queryCount: 10,
          allowedLanguages: ["en"],
          minDeterministicCount: 4,
          weights: { breaking: 1, kgChange: 0.8, fundamental: 0.6 },
        },
        context: {
          ticker: {
            id: "11111111-1111-4111-a111-111111111111",
            symbol: "ACME",
            name: "Acme Co",
            metadata: null,
          },
          topEntities: [],
          recentThemes: [],
          ...emptyEnrichedContext,
        },
        sampling: {
          temperature: 0.9,
          topP: 0.95,
          presencePenalty: 0.4,
          frequencyPenalty: 0.5,
        },
      },
      { generateTextForBrainstorm },
    );
    expect(bullets).toEqual(["margin outlook", "peer comparison"]);
  });
});

describe("fetchQueryAnalysisLlmCandidates", () => {
  const baseParams = {
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    brainstormModel: "gpt-4o-mini",
    maxOutputTokens: 100,
    systemContent: "system",
    userContent: "user context",
    context: {
      ticker: {
        id: "11111111-1111-4111-a111-111111111111",
        symbol: "ACME",
        name: "Acme Co",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
      ...emptyEnrichedContext,
    },
    strategy: {
      queryCount: 10,
      allowedLanguages: ["en"],
      minDeterministicCount: 4,
      weights: { breaking: 1, kgChange: 0.8, fundamental: 0.6 },
    },
    sampling: {
      temperature: 0.9,
      topP: 0.95,
      presencePenalty: 0.4,
      frequencyPenalty: 0.5,
    },
    fewShotExemplarCount: 0,
  };

  it("calls brainstorm first when useBrainstormPass is true", async () => {
    const fetchBrainstormBulletsSpy = vi
      .fn()
      .mockResolvedValue(["angle a", "angle b"]);
    const fetchLlmQueryCandidatesSpy = vi
      .fn()
      .mockResolvedValue([{ text: "ok", intent: "breaking" as const }]);

    await fetchQueryAnalysisLlmCandidates(
      { ...baseParams, useBrainstormPass: true },
      {
        fetchBrainstormBullets: fetchBrainstormBulletsSpy,
        fetchLlmQueryCandidates: fetchLlmQueryCandidatesSpy,
      },
    );

    expect(fetchBrainstormBulletsSpy).toHaveBeenCalledTimes(1);
    expect(fetchLlmQueryCandidatesSpy).toHaveBeenCalledTimes(1);
    const messages = fetchLlmQueryCandidatesSpy.mock.calls[0]?.[0]?.messages as
      | { role: string; content: string }[]
      | undefined;
    expect(messages?.at(-1)?.content).toContain("angle a");
  });

  it("skips brainstorm when useBrainstormPass is false", async () => {
    const fetchBrainstormBulletsSpy = vi.fn();
    const fetchLlmQueryCandidatesSpy = vi
      .fn()
      .mockResolvedValue([{ text: "ok", intent: "breaking" as const }]);

    await fetchQueryAnalysisLlmCandidates(
      { ...baseParams, useBrainstormPass: false },
      {
        fetchBrainstormBullets: fetchBrainstormBulletsSpy,
        fetchLlmQueryCandidates: fetchLlmQueryCandidatesSpy,
      },
    );

    expect(fetchBrainstormBulletsSpy).not.toHaveBeenCalled();
    expect(fetchLlmQueryCandidatesSpy).toHaveBeenCalledTimes(1);
  });
});

describe("fetchLlmQueryCandidates", () => {
  const defaultSampling = {
    temperature: 0.9,
    topP: 0.95,
    presencePenalty: 0.4,
    frequencyPenalty: 0.5,
  };

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
        sampling: defaultSampling,
      },
      { generateObjectForQueries },
    );

    // Assert
    expect(rows).toEqual([{ text: "ok", intent: "breaking" }]);
    expect(generateObjectForQueries).toHaveBeenCalledTimes(1);
  });

  it("forwards default sampling fields to generateObject", async () => {
    // Setup
    const generateObjectForQueries = vi.fn().mockResolvedValue({
      object: { queries: [] },
    });

    // Act
    await fetchLlmQueryCandidates(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 100,
        messages: [{ role: "user", content: "hi" }],
        sampling: defaultSampling,
      },
      { generateObjectForQueries },
    );

    // Assert
    expect(generateObjectForQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.9,
        topP: 0.95,
        presencePenalty: 0.4,
        frequencyPenalty: 0.5,
      }),
    );
    expect(generateObjectForQueries.mock.calls[0]?.[0]).not.toHaveProperty(
      "seed",
    );
  });

  it("forwards custom seed to generateObject when set", async () => {
    // Setup
    const generateObjectForQueries = vi.fn().mockResolvedValue({
      object: { queries: [] },
    });

    // Act
    await fetchLlmQueryCandidates(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 100,
        messages: [{ role: "user", content: "hi" }],
        sampling: { ...defaultSampling, seed: 42 },
      },
      { generateObjectForQueries },
    );

    // Assert
    expect(generateObjectForQueries).toHaveBeenCalledWith(
      expect.objectContaining({ seed: 42 }),
    );
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
          sampling: defaultSampling,
        },
        { generateObjectForQueries },
      ),
    ).rejects.toThrow("api down");
  });
});
