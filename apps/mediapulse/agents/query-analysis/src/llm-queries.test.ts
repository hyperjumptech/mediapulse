/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

import {
  buildBrainstormPrompt,
  buildQueryAnalysisSystemContent,
  buildQueryAnalysisUserContent,
  buildStructuredQueryMessages,
  applySelfCritiqueToCandidateBatch,
  fetchBrainstormBullets,
  fetchLlmQueryCandidates,
  fetchLlmQueryCandidatesByPersona,
  fetchQueryAnalysisLlmCandidates,
  mergeCritiqueReplacements,
  parseBrainstormBullets,
  regenerateDroppedQueries,
  resolveQueryAnalysisSystemContent,
  resolveQueryAnalysisUserContent,
  selectCandidatesToDropFromCritique,
} from "./llm-queries";
import { DEFAULT_QUERY_PERSONAS } from "./personas/default-personas";

describe("resolveQueryAnalysisSystemContent", () => {
  it("matches buildQueryAnalysisSystemContent when Hermes omits override", () => {
    const strategy = {
      queryCount: 10,
      allowedLanguages: ["en", "de"],
      minDeterministicCount: 3,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
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
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
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
        intentWeights: {
          ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
          breaking: 1,
          kg_change: 0.8,
          fundamental: 0.6,
        },
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
          intentWeights: {
            ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
            breaking: 1,
            kg_change: 0.8,
            fundamental: 0.6,
          },
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
      intentWeights: {
        ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
        breaking: 1,
        kg_change: 0.8,
        fundamental: 0.6,
      },
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

describe("selectCandidatesToDropFromCritique", () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({
    text: `query-${String(index + 1)}`,
    intent: "breaking" as const,
  }));

  it("returns at most floor(n * dropFraction) flagged rows, worst first", () => {
    const toDrop = selectCandidatesToDropFromCritique(
      candidates,
      [
        { text: "query-1", relevance: 2, novelty: 1, drop: true },
        { text: "query-5", relevance: 1, novelty: 2, drop: true },
        { text: "query-9", relevance: 3, novelty: 1, drop: true },
        { text: "query-2", relevance: 5, novelty: 5, drop: false },
      ],
      0.3,
    );
    expect(toDrop).toHaveLength(3);
    expect(toDrop.map((row) => row.text)).toEqual([
      "query-1",
      "query-5",
      "query-9",
    ]);
  });

  it("returns an empty list when no rows are flagged drop", () => {
    const toDrop = selectCandidatesToDropFromCritique(
      candidates,
      candidates.map((row) => ({
        text: row.text,
        relevance: 4,
        novelty: 4,
        drop: false,
      })),
      0.25,
    );
    expect(toDrop).toEqual([]);
  });
});

describe("applySelfCritiqueToCandidateBatch", () => {
  const baseParams = {
    apiKey: "sk-test",
    critiqueModel: "gpt-4o-mini",
    generationModel: "gpt-4o-mini",
    maxOutputTokens: 200,
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
    dropFraction: 0.3,
    fewShotExemplarCount: 0,
    sampling: {
      temperature: 0.9,
      topP: 0.95,
      presencePenalty: 0.4,
      frequencyPenalty: 0.5,
    },
  };

  const tenCandidates = Array.from({ length: 10 }, (_, index) => ({
    text: `query-${String(index + 1)}`,
    intent: "breaking" as const,
  }));

  it("calls the regenerator with dropCount matching flagged rows and preserves total count", async () => {
    const critiqueQueryCandidatesSpy = vi.fn().mockResolvedValue([
      { text: "query-1", relevance: 1, novelty: 1, drop: true },
      { text: "query-4", relevance: 2, novelty: 1, drop: true },
      { text: "query-7", relevance: 1, novelty: 2, drop: true },
      ...tenCandidates
        .filter((row) => !["query-1", "query-4", "query-7"].includes(row.text))
        .map((row) => ({
          text: row.text,
          relevance: 5,
          novelty: 5,
          drop: false,
        })),
    ]);
    const regenerateDroppedQueriesSpy = vi.fn().mockResolvedValue([
      { text: "replacement-1", intent: "fundamental" as const },
      { text: "replacement-2", intent: "fundamental" as const },
      { text: "replacement-3", intent: "fundamental" as const },
    ]);

    const result = await applySelfCritiqueToCandidateBatch(
      tenCandidates,
      baseParams,
      {
        critiqueQueryCandidates: critiqueQueryCandidatesSpy,
        regenerateDroppedQueries: regenerateDroppedQueriesSpy,
      },
    );

    expect(regenerateDroppedQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ dropCount: 3 }),
    );
    expect(result.replacedCount).toBe(3);
    expect(result.candidates).toHaveLength(10);
    expect(result.candidates.map((row) => row.text)).toEqual([
      "query-2",
      "query-3",
      "query-5",
      "query-6",
      "query-8",
      "query-9",
      "query-10",
      "replacement-1",
      "replacement-2",
      "replacement-3",
    ]);
  });

  it("does not call the regenerator when zero rows are flagged drop", async () => {
    const critiqueQueryCandidatesSpy = vi.fn().mockResolvedValue(
      tenCandidates.map((row) => ({
        text: row.text,
        relevance: 5,
        novelty: 5,
        drop: false,
      })),
    );
    const regenerateDroppedQueriesSpy = vi.fn();

    const result = await applySelfCritiqueToCandidateBatch(
      tenCandidates,
      baseParams,
      {
        critiqueQueryCandidates: critiqueQueryCandidatesSpy,
        regenerateDroppedQueries: regenerateDroppedQueriesSpy,
      },
    );

    expect(regenerateDroppedQueriesSpy).not.toHaveBeenCalled();
    expect(result.candidates).toEqual(tenCandidates);
    expect(result.replacedCount).toBe(0);
  });
});

describe("mergeCritiqueReplacements", () => {
  it("preserves persona tags on replacement rows", () => {
    const merged = mergeCritiqueReplacements(
      [
        { text: "keep", intent: "breaking", persona: "analyst" },
        { text: "drop me", intent: "breaking", persona: "analyst" },
      ],
      [{ text: "drop me", intent: "breaking", persona: "analyst" }],
      [{ text: "new query", intent: "fundamental" }],
    );
    expect(merged).toEqual([
      { text: "keep", intent: "breaking", persona: "analyst" },
      { text: "new query", intent: "fundamental", persona: "analyst" },
    ]);
  });
});

describe("regenerateDroppedQueries", () => {
  it("returns an empty array when dropCount is zero", async () => {
    const fetchLlmQueryCandidatesSpy = vi.fn();
    const rows = await regenerateDroppedQueries(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        maxOutputTokens: 100,
        systemContent: "system",
        userContent: "user",
        keptCandidates: [],
        dropCount: 0,
        fewShotExemplarCount: 0,
        sampling: {
          temperature: 0.9,
          topP: 0.95,
          presencePenalty: 0.4,
          frequencyPenalty: 0.5,
        },
      },
      { fetchLlmQueryCandidates: fetchLlmQueryCandidatesSpy },
    );
    expect(rows).toEqual([]);
    expect(fetchLlmQueryCandidatesSpy).not.toHaveBeenCalled();
  });
});

describe("fetchLlmQueryCandidatesByPersona", () => {
  const personas = DEFAULT_QUERY_PERSONAS.slice(0, 3);
  const baseParams = {
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    maxOutputTokens: 100,
    systemContent: "system",
    userContent: "user context",
    personas,
    perPersonaQuota: 3,
    fewShotExemplarCount: 0,
    sampling: {
      temperature: 0.9,
      topP: 0.95,
      presencePenalty: 0.4,
      frequencyPenalty: 0.5,
    },
  };

  it("calls generateObject once per persona and tags results", async () => {
    const fetchLlmQueryCandidatesSpy = vi
      .fn()
      .mockImplementation(async (_params, _deps) => {
        const callIndex = fetchLlmQueryCandidatesSpy.mock.calls.length - 1;
        const persona = personas[callIndex];
        return [
          {
            text: `${persona?.id}-q1`,
            intent: "breaking" as const,
          },
        ];
      });

    const rows = await fetchLlmQueryCandidatesByPersona(baseParams, {
      fetchLlmQueryCandidates: fetchLlmQueryCandidatesSpy,
    });

    expect(fetchLlmQueryCandidatesSpy).toHaveBeenCalledTimes(3);
    expect(rows).toEqual([
      { text: "analyst-q1", intent: "breaking", persona: "analyst" },
      { text: "retail-q1", intent: "breaking", persona: "retail" },
      { text: "regulator-q1", intent: "breaking", persona: "regulator" },
    ]);
  });

  it("continues when one persona call fails", async () => {
    const fetchLlmQueryCandidatesSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce([
        { text: "retail ok", intent: "breaking" as const },
      ])
      .mockResolvedValueOnce([
        { text: "regulator ok", intent: "fundamental" as const },
      ]);
    const warn = vi.fn();

    const rows = await fetchLlmQueryCandidatesByPersona(baseParams, {
      fetchLlmQueryCandidates: fetchLlmQueryCandidatesSpy,
      warn,
    });

    expect(fetchLlmQueryCandidatesSpy).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      { text: "retail ok", intent: "breaking", persona: "retail" },
      { text: "regulator ok", intent: "fundamental", persona: "regulator" },
    ]);
  });

  it("caps each persona at perPersonaQuota", async () => {
    const fetchLlmQueryCandidatesSpy = vi.fn().mockResolvedValue([
      { text: "one", intent: "breaking" as const },
      { text: "two", intent: "breaking" as const },
      { text: "three", intent: "breaking" as const },
      { text: "four", intent: "breaking" as const },
    ]);

    const rows = await fetchLlmQueryCandidatesByPersona(
      { ...baseParams, perPersonaQuota: 2 },
      { fetchLlmQueryCandidates: fetchLlmQueryCandidatesSpy },
    );

    expect(rows.filter((row) => row.persona === "analyst")).toHaveLength(2);
  });

  it("appends persona system nudge to the structured system prompt", async () => {
    const fetchLlmQueryCandidatesSpy = vi.fn().mockResolvedValue([]);
    await fetchLlmQueryCandidatesByPersona(baseParams, {
      fetchLlmQueryCandidates: fetchLlmQueryCandidatesSpy,
    });
    const firstMessages = fetchLlmQueryCandidatesSpy.mock.calls[0]?.[0]
      ?.messages as { role: string; content: string }[] | undefined;
    expect(firstMessages?.[0]?.content).toContain("system");
    expect(firstMessages?.[0]?.content).toContain(personas[0]!.systemNudge);
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
