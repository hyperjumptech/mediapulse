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
  ai: { apiKey: "sk-ai", model: "test-model", baseUrl: "" },
});

const discoveredCompetitors = [
  { name: "Bank Mandiri", aliases: ["BMRI"], searchKeywords: ["kredit"] },
];
const discoveredRegulators = [
  { name: "OJK", aliases: [], searchKeywords: ["regulasi bank"] },
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
  const client = {
    queryAnalysis: { get, create },
    tickerDiscoveryLookup: { create: lookupCreate },
    tickerDiscoveryRecord: { create: recordCreate },
  };

  return { client, get, create, lookupCreate, recordCreate };
};

/** Fake `generateObject` returning a discovery result and token usage. */
const makeGenerate = () =>
  vi.fn().mockResolvedValue({
    object: {
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
    },
    usage: { inputTokens: 120, outputTokens: 40, totalTokens: 160 },
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
let countHits: ReturnType<typeof makeCountHits>;

beforeEach(() => {
  generate = makeGenerate();
  countHits = makeCountHits();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runQueryAnalysis — cold run (cache miss)", () => {
  it("discovers entities, writes the cache, and persists a self-driving query set", async () => {
    // Setup
    const { client, create, lookupCreate, recordCreate } = makeClient(null);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      countHits: countHits as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(lookupCreate).toHaveBeenCalledWith({ tickerId: TICKER_ID });
    expect(recordCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: TICKER_ID,
        competitors: discoveredCompetitors,
        regulators: discoveredRegulators,
        model: "test-model",
        ttlSeconds: 14 * 24 * 60 * 60,
      }),
    );

    const body = create.mock.calls[0]?.[0];
    expect(body.generationSource).toBe("self_driving_v1");
    expect(body.activate).toBe(true);
    expect(body.queries.length).toBeGreaterThan(0);
    expect(body.strategySnapshot.agentVersion).toBe("3.0.0");
    expect(body.strategySnapshot.llmUsage.cacheHit).toBe(false);
    expect(body.strategySnapshot.llmUsage.totalTokens).toBe(160);
    expect(body.strategySnapshot.discovered.competitors).toContain(
      "Bank Mandiri",
    );
    expect(body.strategySnapshot.discovered.regulators).toContain("OJK");
    expect(body.strategySnapshot.providerUsage.searchProvider[0]?.name).toBe(
      "serper",
    );
    expect(body.strategySnapshot.providerUsage.searchCredits).toBeGreaterThan(
      0,
    );
    expect(body.strategySnapshot.contractVersion).toBe("1.0");
  });

  it("ranks queries by probe hits (descending) and assigns contiguous ranks", async () => {
    // Setup
    const { client, create } = makeClient(null);
    countHits = makeCountHits({ BBRI: 99, "Bank Rakyat Indonesia": 42 });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
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
  it("skips discovery and cache write when a fresh entry exists", async () => {
    // Setup
    const { client, create, recordCreate } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      countHits: countHits as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    expect(generate).not.toHaveBeenCalled();
    expect(recordCreate).not.toHaveBeenCalled();

    const body = create.mock.calls[0]?.[0];
    expect(body.strategySnapshot.llmUsage.cacheHit).toBe(true);
    expect(body.strategySnapshot.discovered.competitors).toContain(
      "Bank Mandiri",
    );
  });
});

describe("runQueryAnalysis — yield probe", () => {
  it("drops zero-yield candidates and records them in the snapshot", async () => {
    // Setup
    const { client, create } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
      expiresAt: "2026-07-20T00:00:00.000Z",
    });
    countHits = makeCountHits({ BBRI: 0 });
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generate: generate as never,
      countHits: countHits as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    const body = create.mock.calls[0]?.[0];
    expect(body.strategySnapshot.probe.droppedZeroYield).toContain("BBRI");
    expect(
      body.queries.some((query: { text: string }) => query.text === "BBRI"),
    ).toBe(false);
  });

  it("guarantees section coverage even when every candidate is zero-yield", async () => {
    // Setup
    const { client, create } = makeClient({
      tickerId: TICKER_ID,
      competitors: discoveredCompetitors,
      regulators: discoveredRegulators,
      model: "cached-model",
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
    expect(intents.has("competitor")).toBe(true);
    expect(intents.has("regulatory")).toBe(true);
    expect(intents.has("industry_trend")).toBe(true);
  });
});
