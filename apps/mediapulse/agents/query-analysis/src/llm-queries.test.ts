/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";

import {
  DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  QUERY_ANALYSIS_STANDARD_INTENTS,
} from "@workspace/agent-data-api-contract";

import {
  buildQueryAnalysisSystemContent,
  buildQueryAnalysisUserContent,
  computeQueryAnalysisIntentTargetCounts,
  formatPriorYieldIntentHints,
  serializeQueryAnalysisContextBlock,
  buildStructuredQueryMessages,
  applySelfCritiqueToCandidateBatch,
  fetchLlmQueryCandidates,
  fetchLlmQueryCandidatesByPersona,
  fetchWildcardCandidates,
  mergeCritiqueReplacements,
  regenerateDroppedQueries,
  resolveWildcardSystemContent,
  resolveWildcardUserContent,
  selectCandidatesToDropFromCritique,
} from "./llm-queries";
import { DEFAULT_QUERY_PERSONAS } from "./personas/default-personas";

/** Fixed strategy/context pair for golden fingerprint regression (plan 16). */
const GOLDEN_PROMPT_FINGERPRINT_FIXTURE = {
  strategy: {
    queryCount: 10,
    language: "en",
    minDeterministicCount: 4,
    intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  },
  context: {
    ticker: {
      id: "22222222-2222-4222-a222-222222222222",
      symbol: "ABC",
      name: "ABC Ltd",
      metadata: null,
    },
    topEntities: [] as [],
    recentThemes: [] as [],
    peers: [] as [],
    calendar: { recentEventTypes: [] as string[] },
    headlineSamples: [] as [],
    kgNeighborhood: [] as [],
  },
  fingerprint: "091297a760adf9a3",
} as const;

const emptyEnrichedContext = {
  peers: [] as [],
  calendar: { recentEventTypes: [] as string[] },
  headlineSamples: [] as [],
  kgNeighborhood: [] as [],
};

describe("computeQueryAnalysisIntentTargetCounts", () => {
  it("returns a rounded target count for every standard intent", () => {
    const counts = computeQueryAnalysisIntentTargetCounts({
      queryCount: 10,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    });

    expect(Object.keys(counts)).toHaveLength(
      QUERY_ANALYSIS_STANDARD_INTENTS.length,
    );
    for (const intent of QUERY_ANALYSIS_STANDARD_INTENTS) {
      expect(counts[intent]).toBeGreaterThanOrEqual(0);
    }
  });

  it("weights higher-priority intents toward larger targets", () => {
    const counts = computeQueryAnalysisIntentTargetCounts({
      queryCount: 10,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    });

    expect(counts.breaking).toBeGreaterThanOrEqual(counts.esg);
    expect(counts.kg_change).toBeGreaterThanOrEqual(counts.technical);
  });
});

describe("buildQueryAnalysisSystemContent", () => {
  it("includes language lock, intent mix hints, and schema instructions", () => {
    // Act
    const text = buildQueryAnalysisSystemContent({
      queryCount: 10,
      language: "id",
      minDeterministicCount: 3,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    });

    // Assert
    expect(text).toContain("All queries must be in id");
    expect(text).toContain("kg_change");
    expect(text).toContain("3");
    expect(text).toContain('"queries"');
  });

  it("interpolates per-intent target counts and taxonomy labels inline", () => {
    const text = buildQueryAnalysisSystemContent({
      queryCount: 10,
      language: "en",
      minDeterministicCount: 4,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    });
    const targets = computeQueryAnalysisIntentTargetCounts({
      queryCount: 10,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    });

    expect(text).toContain("- breaking:");
    expect(text).toContain(`- esg: ${String(targets.esg)}`);
    expect(text).toContain(`- supply_chain: ${String(targets.supply_chain)}`);
    expect(text).toContain(`- technical: ${String(targets.technical)}`);
    expect(text).toContain("supply_chain: suppliers, logistics");
    expect(text).toContain("esg: environmental, social, governance");
    expect(text).not.toContain("{{");
  });

  it("states the explicit total query count and does not embed a bare '2 queries' cap", () => {
    const text = buildQueryAnalysisSystemContent({
      queryCount: 10,
      language: "en",
      minDeterministicCount: 4,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    });

    expect(text).toContain("approximately 10 queries in total");
    expect(text).not.toContain("at most 2 queries");
  });

  it("uses unambiguous words-per-query phrasing for the default queryMaxWords", () => {
    const text = buildQueryAnalysisSystemContent({
      queryCount: 10,
      language: "en",
      minDeterministicCount: 4,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
    });

    expect(text).toContain("Keep each query to about 2–5 words.");
    expect(text).not.toContain("Prefer 2-word keyword phrases.");
  });

  it("uses unambiguous words-per-query phrasing when queryMaxWords is 2", () => {
    const text = buildQueryAnalysisSystemContent({
      queryCount: 10,
      language: "en",
      minDeterministicCount: 4,
      intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
      queryMaxWords: 2,
    });

    expect(text).toContain("Keep each query to about 2 words.");
    expect(text).not.toContain("Prefer 2-word keyword phrases.");
  });
});

describe("llm prompt fingerprint", () => {
  it("stays stable for a fixed strategy and context fixture", () => {
    const { strategy, context, fingerprint } =
      GOLDEN_PROMPT_FINGERPRINT_FIXTURE;
    const computed = computeLlmPromptFingerprint(
      buildQueryAnalysisSystemContent(strategy),
      buildQueryAnalysisUserContent(context, strategy.language),
    );

    expect(computed).toBe(fingerprint);
  });
});

describe("wildcard prompt builders", () => {
  const wildcardContext = {
    ticker: {
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "ACME",
      name: "Acme Co",
      metadata: null,
    },
    topEntities: [] as [],
    recentThemes: [] as [],
    ...emptyEnrichedContext,
  };

  it("system prompt omits intent taxonomy and includes slot count and languages", () => {
    const text = resolveWildcardSystemContent(3, ["en", "id"]);

    expect(text).toContain("Generate 3 short search queries");
    expect(text).toContain("en, id");
    expect(text.toLowerCase()).toContain("lateral");
    expect(text).not.toContain("breaking:");
    expect(text).not.toContain("targetBreakingCount");
  });

  it("user prompt is serialized GET context only", () => {
    const text = resolveWildcardUserContent(wildcardContext);

    expect(text).toContain("ACME");
    expect(text).toContain("Acme Co");
    expect(text).not.toContain("{{");
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
    expect(text).toContain("Recent events: ratings_change");
    expect(text).not.toContain("Next earnings:");
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

  it("includes past performance hints when priorYield perIntent is present", () => {
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
      priorYield: {
        perIntent: [
          { intent: "fundamental", avgArticles: 3.2, avgNovel: 3.2 },
          { intent: "sentiment", avgArticles: 0.4, avgNovel: 0.4 },
        ],
        perPersona: [],
      },
    });

    expect(text).toContain("Past performance hints:");
    expect(text).toContain("fundamental queries surfaced 3.2 novel articles");
    expect(text).toContain("sentiment queries surfaced 0.4 novel articles");
    expect(text).toContain("Bias your generation accordingly.");
  });
});

describe("formatPriorYieldIntentHints", () => {
  it("returns empty string when prior yield is absent", () => {
    expect(formatPriorYieldIntentHints(undefined)).toBe("");
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
    expect(messages[messages.length - 1]).toEqual({
      role: "user",
      content: "live context",
    });
  });

  it("uses the user content verbatim as the final user message", () => {
    const messages = buildStructuredQueryMessages({
      systemContent: "system",
      userContent: "live context",
      fewShotExemplarCount: 0,
    });
    const finalUser = messages[messages.length - 1];
    expect(finalUser).toEqual({ role: "user", content: "live context" });
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
        systemContent: "system",
        userContent: "user",
        keptCandidates: [],
        dropCount: 0,
        fewShotExemplarCount: 0,
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
    systemContent: "system",
    userContent: "user context",
    personas,
    perPersonaQuota: 3,
    fewShotExemplarCount: 0,
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
        messages: [{ role: "user", content: "hi" }],
      },
      { generateObjectForQueries },
    );

    // Assert
    expect(rows).toEqual([{ text: "ok", intent: "breaking" }]);
    expect(generateObjectForQueries).toHaveBeenCalledTimes(1);
  });

  it("does not pass seed or providerOptions to generateObject", async () => {
    // Setup
    const generateObjectForQueries = vi.fn().mockResolvedValue({
      object: { queries: [] },
    });

    // Act
    await fetchLlmQueryCandidates(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      },
      { generateObjectForQueries },
    );

    // Assert
    const callArgs = generateObjectForQueries.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(callArgs).not.toHaveProperty("seed");
    expect(callArgs).not.toHaveProperty("providerOptions");
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
          messages: [{ role: "user", content: "hi" }],
        },
        { generateObjectForQueries },
      ),
    ).rejects.toThrow("api down");
  });
});

describe("fetchWildcardCandidates", () => {
  const baseContext = {
    ticker: {
      id: "11111111-1111-4111-a111-111111111111",
      symbol: "ACME",
      name: "Acme Co",
      metadata: null,
    },
    topEntities: [] as [],
    recentThemes: [] as [],
    recentRelationDeltas: [] as [],
    ...emptyEnrichedContext,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tags rows with wildcard intent and respects count cap", async () => {
    const generateObjectForWildcards = vi.fn().mockResolvedValue({
      object: {
        queries: [
          { text: "First odd angle" },
          { text: "Second odd angle" },
          { text: "Third odd angle" },
        ],
      },
    });

    const rows = await fetchWildcardCandidates(
      {
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        count: 2,
        context: baseContext,
        allowedLanguages: ["en"],
      },
      { generateObjectForWildcards },
    );

    expect(rows).toEqual([
      { text: "First odd angle", intent: "wildcard" },
      { text: "Second odd angle", intent: "wildcard" },
    ]);
  });
});

describe("buildQueryAnalysisSystemContent — contract brief", () => {
  const baseStrategy = {
    queryCount: 10,
    language: "en",
    minDeterministicCount: 3,
    intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  };

  it("returns identical output with no brief (reversibility guarantee)", () => {
    const withoutBrief = buildQueryAnalysisSystemContent(baseStrategy);
    const withUndefinedBrief = buildQueryAnalysisSystemContent({
      ...baseStrategy,
      brief: undefined,
    });
    expect(withoutBrief).toBe(withUndefinedBrief);
  });

  it("appends product_contract block when brief is present", () => {
    const result = buildQueryAnalysisSystemContent({
      ...baseStrategy,
      brief: "Daily industry newsletter for executives.",
    });

    expect(result).toContain("<product_contract>");
    expect(result).toContain("Daily industry newsletter for executives.");
    expect(result).toContain("</product_contract>");
  });

  it("prompt fingerprint differs when brief is present vs absent", () => {
    const fingerprintWithout = computeLlmPromptFingerprint(
      buildQueryAnalysisSystemContent(baseStrategy),
      "user content",
    );
    const fingerprintWith = computeLlmPromptFingerprint(
      buildQueryAnalysisSystemContent({ ...baseStrategy, brief: "A brief." }),
      "user content",
    );

    expect(fingerprintWith).not.toBe(fingerprintWithout);
  });
});

describe("buildQueryAnalysisSystemContent — section coverage", () => {
  const baseStrategy = {
    queryCount: 10,
    language: "en",
    minDeterministicCount: 3,
    intentWeights: DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
  };

  it("always includes M&A guidance via the deals intent description", () => {
    // The deals intent is now always present in the intent listing regardless of
    // sectionCoverageEnabled, so M&A guidance appears unconditionally.
    const result = buildQueryAnalysisSystemContent({
      ...baseStrategy,
      sectionCoverageEnabled: false,
    });

    expect(result).toContain("M&A");
    expect(result).toContain("deals:");
  });

  it("includes the deals intent in the intent listing when sectionCoverageEnabled is true", () => {
    const result = buildQueryAnalysisSystemContent({
      ...baseStrategy,
      sectionCoverageEnabled: true,
    });

    expect(result).toContain("M&A");
    expect(result).toContain("deals:");
  });
});

describe("computeQueryAnalysisIntentTargetCounts — section coverage floor", () => {
  it("does not change counts when sectionCoverageEnabled is false", () => {
    const zeroWeights = Object.fromEntries(
      QUERY_ANALYSIS_STANDARD_INTENTS.map((intent) => [intent, 0]),
    ) as Record<(typeof QUERY_ANALYSIS_STANDARD_INTENTS)[number], number>;

    const counts = computeQueryAnalysisIntentTargetCounts({
      queryCount: 10,
      intentWeights: {
        ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
        competitor: 0,
      },
      sectionCoverageEnabled: false,
    });

    expect(counts.competitor).toBe(0);
  });

  it("bumps intents that map to a section to at least 1 when sectionCoverageEnabled", () => {
    const withZeroCompetitor = {
      ...DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
      competitor: 0,
      industry_trend: 0,
    };

    const counts = computeQueryAnalysisIntentTargetCounts({
      queryCount: 10,
      intentWeights: withZeroCompetitor,
      sectionCoverageEnabled: true,
    });

    expect(counts.competitor).toBeGreaterThanOrEqual(1);
    expect(counts.industry_trend).toBeGreaterThanOrEqual(1);
  });
});
