/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CountQueryHitsContext } from "@workspace/agent-search";

import { queryAnalysisConfigSchema } from "./config-schema";

vi.mock("@mediapulse/env/agents-query-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
    AGENT_REGISTRY_URL: "http://agent-registry-api",
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { runQueryAnalysis, type RunQueryAnalysisDeps } from "./run";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

const baseTicker = {
  id: TICKER_ID,
  symbol: "BBRI",
  name: "Bank Rakyat Indonesia",
  metadata: null,
  sector: "Keuangan",
  industry: "Bank",
  subSector: null,
  subIndustry: null,
  businessActivity: "Perbankan",
};

const config = queryAnalysisConfigSchema.parse({
  web_search: [{ provider: "serper", apiKey: "sk-serper" }],
  language_model: { apiKey: "sk-ai", model: "test-model", baseUrl: "" },
});

const discoveredCompetitors = [
  { name: "Bank Mandiri", aliases: ["BMRI"], searchKeywords: ["kredit"] },
];
const discoveredRegulators = [
  { name: "OJK", aliases: [], searchKeywords: ["regulasi bank"] },
];

const generatedCandidates = [
  { intent: "dealsAndMovements", language: "id", text: "BBRI" },
  {
    intent: "dealsAndMovements",
    language: "id",
    text: "Bank Rakyat Indonesia",
  },
  { intent: "competitiveLandscape", language: "id", text: "Bank Mandiri" },
  { intent: "regulatoryPolicyWatch", language: "id", text: "OJK" },
  { intent: "industryPulse", language: "id", text: "industri Bank Indonesia" },
];

/** Builds a fresh mock agent-data-api client. */
const makeClient = (lookupEntry: unknown) => {
  const get = vi.fn().mockResolvedValue({
    ticker: baseTicker,
  });
  const create = vi.fn().mockResolvedValue({
    created: 1,
    createdSetId: "22222222-2222-4222-a222-222222222222",
    activeSetId: "22222222-2222-4222-a222-222222222222",
  });
  const lookupCreate = vi.fn().mockResolvedValue({ entry: lookupEntry });
  const recordCreate = vi.fn().mockResolvedValue({
    tickerId: TICKER_ID,
    expiresAt: "2026-07-20T00:00:00.000Z",
  });
  const queryAnalysisRunsCreate = vi.fn().mockResolvedValue({
    id: "33333333-3333-4333-a333-333333333333",
    tickerId: TICKER_ID,
    executionId: null,
    queries: [],
    createdAt: "2026-07-08T10:00:00.000Z",
  });
  const client = {
    queryAnalysis: { get, create },
    tickerDiscoveryLookup: { create: lookupCreate },
    tickerDiscoveryRecord: { create: recordCreate },
    queryAnalysisRuns: { create: queryAnalysisRunsCreate },
  };

  return {
    client,
    get,
    create,
    lookupCreate,
    recordCreate,
    queryAnalysisRunsCreate,
  };
};

/** Fake `generateObject` returning a discovery result and token usage. */
const makeGenerate = () =>
  vi.fn().mockResolvedValue({
    object: {
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      mainInputs: ["kredit korporasi"],
      customerSegments: ["nasabah ritel"],
    },
    usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 },
  });

/** Fake `generateObject` returning a fixed query-candidate batch and token usage. */
const makeGenerateQueries = () =>
  vi.fn().mockResolvedValue({
    object: generatedCandidates,
    usage: { inputTokens: 80, outputTokens: 30, totalTokens: 110 },
  });

/** Fake `countQueryHits` that scores by an override map and accrues credits. */
const makeCountHits = (hitsByText: Record<string, number> = {}) =>
  vi.fn(async (text: string, context: CountQueryHitsContext) => {
    if (context.creditsSink) {
      context.creditsSink.credits += 1;
    }
    const hits = hitsByText[text] ?? 5;

    return { hits, credits: 1, provider: "serper" };
  });

const makeContext = () => ({
  input: { tickerId: TICKER_ID },
  config,
  token: "Bearer token",
  contract: { brief: "Track BBRI and Indonesian banking.", version: "1.0" },
});

let generate: ReturnType<typeof makeGenerate>;
let generateQueries: ReturnType<typeof makeGenerateQueries>;
let countHits: ReturnType<typeof makeCountHits>;

beforeEach(() => {
  generate = makeGenerate();
  generateQueries = makeGenerateQueries();
  countHits = makeCountHits();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runQueryAnalysis — cold run (cache miss)", () => {
  it("does not write the cache when discovery returns no entities", async () => {
    // Setup
    const { client, recordCreate } = makeClient(null);
    const emptyGenerate = vi.fn().mockResolvedValue({
      object: {
        competitors: [],
        regulators: [],
        mainInputs: [],
        customerSegments: [],
      },
      usage: undefined,
    });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: emptyGenerate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    expect(emptyGenerate).toHaveBeenCalledTimes(1);
    expect(recordCreate).not.toHaveBeenCalled();
  });

  it("gathers recon signals and passes them into generation", async () => {
    // Setup
    const { client } = makeClient(null);
    const reconSearch = vi.fn(async () => [
      {
        url: "https://example.test/1",
        title: "Kopi Kenangan raises Series C",
        snippet: "s",
      },
    ]);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
      reconSearch: reconSearch as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(reconSearch).toHaveBeenCalled();
    const generationPrompt = generateQueries.mock.calls[0]?.[0].prompt;
    expect(generationPrompt).toContain("Recent signals");
    expect(generationPrompt).toContain("Kopi Kenangan raises Series C");
  });

  it("discovers entities, generates queries, writes the cache with the contract version, and persists a self-driving query set", async () => {
    // Setup
    const {
      client,
      create,
      lookupCreate,
      recordCreate,
      queryAnalysisRunsCreate,
    } = makeClient(null);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generateQueries).toHaveBeenCalledTimes(1);
    expect(lookupCreate).toHaveBeenCalledWith({ tickerId: TICKER_ID });
    expect(recordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: TICKER_ID,
        competitors: discoveredCompetitors,
        regulators: discoveredRegulators,
        model: "test-model",
        contractVersion: "1.0",
        ttlSeconds: 14 * 24 * 60 * 60,
      }),
    );

    const body = create.mock.calls[0]?.[0];
    expect(body.generationSource).toBe("self_driving_v1");
    expect(body.activate).toBe(true);
    expect(body.queries.length).toBeGreaterThan(0);
    expect(body.agentId).toBe("query-analysis");
    expect(body.agentVersion).toBe("3.0.0");
    expect(body.strategySnapshot.agentVersion).toBe("3.0.0");
    expect(body.strategySnapshot.llmUsage.cacheHit).toBe(false);
    expect(body.strategySnapshot.llmUsage.totalTokens).toBe(270);
    expect(body.strategySnapshot.discovered.competitors).toContain(
      "Bank Mandiri",
    );
    expect(body.strategySnapshot.discovered.regulators).toContain("OJK");
    expect(body.strategySnapshot.generation.attempts).toBe(1);
    expect(body.strategySnapshot.providerUsage.searchProvider[0]?.name).toBe(
      "serper",
    );
    expect(body.strategySnapshot.providerUsage.searchCredits).toBeGreaterThan(
      0,
    );
    expect(body.strategySnapshot.contractVersion).toBe("1.0");

    // Writes the per-query chronicle with at least one included decision.
    expect(queryAnalysisRunsCreate).toHaveBeenCalledTimes(1);
    const chronicle = queryAnalysisRunsCreate.mock.calls[0]?.[0];
    expect(chronicle.tickerId).toBe(TICKER_ID);
    expect(Array.isArray(chronicle.queries)).toBe(true);
    expect(
      chronicle.queries.some(
        (decision: { included: boolean }) => decision.included,
      ),
    ).toBe(true);
  });

  it("ranks queries by probe hits (descending) and assigns contiguous ranks", async () => {
    // Setup
    const { client, create } = makeClient(null);
    countHits = makeCountHits({ BBRI: 99, "Bank Rakyat Indonesia": 42 });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    const body = create.mock.calls[0]?.[0];
    const ranks = body.queries.map((query: { rank: number }) => query.rank);
    expect(ranks).toEqual([...ranks].sort((a: number, b: number) => a - b));
    expect(body.queries[0]?.text).toBe("BBRI");
    expect(body.queries[0]?.rank).toBe(1);
  });
});

describe("runQueryAnalysis — warm run (cache hit)", () => {
  it("skips discovery and cache write when a fresh entry with a matching contract version exists", async () => {
    // Setup
    const { client, create, recordCreate } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      contractVersion: "1.0",
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    expect(generate).not.toHaveBeenCalled();
    expect(generateQueries).toHaveBeenCalledTimes(1);
    expect(recordCreate).not.toHaveBeenCalled();

    const body = create.mock.calls[0]?.[0];
    expect(body.strategySnapshot.llmUsage.cacheHit).toBe(true);
    expect(body.strategySnapshot.discovered.competitors).toContain(
      "Bank Mandiri",
    );
  });

  it("treats a contract-version mismatch as a cache miss and re-runs discovery", async () => {
    // Setup
    const { client, create, recordCreate } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      contractVersion: "0.9",
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(recordCreate).toHaveBeenCalledWith(
      expect.objectContaining({ contractVersion: "1.0" }),
    );
    const body = create.mock.calls[0]?.[0];
    expect(body.strategySnapshot.llmUsage.cacheHit).toBe(false);
  });

  it("treats a legacy entry with no contractVersion as a cache miss", async () => {
    // Setup
    const { client } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      contractVersion: null,
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("runQueryAnalysis — generation failure", () => {
  it("persists nothing and reports failure when the generation LLM call fails (leaving the prior set active)", async () => {
    // Setup
    const { client, create } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      contractVersion: "1.0",
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    const failingGenerateQueries = vi.fn().mockRejectedValue(new Error("boom"));
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: failingGenerateQueries as never,
      countHits: countHits as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("runQueryAnalysis — yield probe", () => {
  it("records zero-yield candidates as dropped in the probe snapshot and reinstates them to meet the intent floor", async () => {
    // Setup
    const { client, create } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      contractVersion: "1.0",
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    countHits = makeCountHits({ BBRI: 0 });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: countHits as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    const body = create.mock.calls[0]?.[0];
    expect(body.strategySnapshot.probe.droppedZeroYield).toContain("BBRI");
    expect(
      body.queries.some((query: { text: string }) => query.text === "BBRI"),
    ).toBe(true);
  });

  it("guarantees section coverage even when every candidate is zero-yield", async () => {
    // Setup
    const { client, create } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      contractVersion: "1.0",
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    const allZero = vi.fn(
      async (_text: string, context: CountQueryHitsContext) => {
        if (context.creditsSink) {
          context.creditsSink.credits += 1;
        }

        return { hits: 0, credits: 1, provider: "serper" };
      },
    );
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      generateQueries: generateQueries as never,
      countHits: allZero as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    const body = create.mock.calls[0]?.[0];
    const intents = new Set(
      body.queries.map((query: { intent: string }) => query.intent),
    );
    // Reinstated coverage spans the dedicated-intent sections.
    expect(intents.has("competitiveLandscape")).toBe(true);
    expect(intents.has("regulatoryPolicyWatch")).toBe(true);
    expect(intents.has("industryPulse")).toBe(true);
  });
});
