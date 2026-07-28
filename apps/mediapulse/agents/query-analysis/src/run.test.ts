/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  // One per intent keeps the fixture small; the quota logic itself is covered in
  // generate-with-coverage.test.ts.
  generation: { queriesPerIntent: 1 },
});

const profileCompetitors = [{ name: "Bank Mandiri", aliases: ["BMRI"] }];
const profileRegulators = [
  { name: "Otoritas Jasa Keuangan", aliases: ["OJK"] },
];

const baseProfile = {
  companyOverview: "State-owned bank focused on micro lending.",
  businessOperation: "Lends to micro and small businesses across Indonesia.",
  sector: { indonesian: "Keuangan", english: "Financials" },
  subSector: { indonesian: "Perbankan", english: "Banking" },
  industry: { indonesian: "Bank Umum", english: "Commercial Banking" },
  subIndustry: {
    indonesian: "Perbankan Mikro dan Ritel",
    english: "Micro and Retail Banking",
  },
  aliases: ["BBRI", "BRI"],
  competitors: profileCompetitors,
  regulators: profileRegulators,
};

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
  { intent: "disruptorsOrTech", language: "id", text: "fintech Indonesia" },
];

/** Builds a fresh mock agent-data-api client. */
const makeClient = (profile: unknown) => {
  const get = vi.fn().mockResolvedValue({ ticker: baseTicker, profile });
  const create = vi.fn().mockResolvedValue({
    created: 1,
    createdSetId: "22222222-2222-4222-a222-222222222222",
    activeSetId: "22222222-2222-4222-a222-222222222222",
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
    queryAnalysisRuns: { create: queryAnalysisRunsCreate },
  };

  return { client, get, create, queryAnalysisRunsCreate };
};

/** Fake `generateObject` returning a fixed query-candidate batch and token usage. */
const makeGenerateQueries = () =>
  vi.fn().mockResolvedValue({
    object: generatedCandidates,
    usage: { inputTokens: 80, outputTokens: 30, totalTokens: 110 },
  });

const makeContext = (queriesPerIntent?: number) => ({
  input: { tickerId: TICKER_ID },
  config:
    queriesPerIntent === undefined
      ? config
      : { ...config, generation: { queriesPerIntent } },
  token: "Bearer token",
  contract: { brief: "Track BBRI and Indonesian banking.", version: "1.0" },
});

let generateQueries: ReturnType<typeof makeGenerateQueries>;

beforeEach(() => {
  generateQueries = makeGenerateQueries();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runQueryAnalysis — with a curated profile", () => {
  it("generates queries from the profile and persists a self-driving query set", async () => {
    // Setup
    const { client, create, queryAnalysisRunsCreate } = makeClient(baseProfile);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: generateQueries as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    expect(generateQueries).toHaveBeenCalledTimes(1);

    const body = create.mock.calls[0]?.[0];
    expect(body.generationSource).toBe("self_driving_v1");
    expect(body.activate).toBe(true);
    expect(body.queries.length).toBeGreaterThan(0);
    expect(body.agentId).toBe("query-analysis");
    expect(body.agentVersion).toBe("3.0.0");
    expect(body.strategySnapshot.agentVersion).toBe("3.0.0");
    expect(body.strategySnapshot.llmUsage.totalTokens).toBe(110);
    expect(body.strategySnapshot.profile.present).toBe(true);
    expect(body.strategySnapshot.profile.competitors).toContain("Bank Mandiri");
    expect(body.strategySnapshot.profile.regulators).toContain(
      "Otoritas Jasa Keuangan",
    );
    expect(body.strategySnapshot.generation.attempts).toBe(1);
    expect(body.strategySnapshot.contractVersion).toBe("1.0");

    // Writes the per-query chronicle with at least one included decision.
    expect(queryAnalysisRunsCreate).toHaveBeenCalledTimes(1);
    const chronicle = queryAnalysisRunsCreate.mock.calls[0]?.[0];
    expect(chronicle.tickerId).toBe(TICKER_ID);
    expect(
      chronicle.queries.some(
        (decision: { included: boolean }) => decision.included,
      ),
    ).toBe(true);
  });

  it("puts the curated prose, competitors and English classification in the prompt", async () => {
    // Setup
    const { client } = makeClient(baseProfile);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: generateQueries as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    const prompt = generateQueries.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain("State-owned bank focused on micro lending.");
    expect(prompt).toContain(
      "Lends to micro and small businesses across Indonesia.",
    );
    expect(prompt).toContain("Bank Mandiri (aka BMRI)");
    expect(prompt).toContain("Financials");
    expect(prompt).toContain("Micro and Retail Banking");
  });

  it("phrases recon searches from the Indonesian classification and curated rivals", async () => {
    // Setup
    const { client } = makeClient(baseProfile);
    const reconSearch = vi.fn(async () => [
      {
        url: "https://example.test/1",
        title: "Bank Mandiri raises lending target",
        snippet: "s",
      },
    ]);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: generateQueries as never,
      reconSearch: reconSearch as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    const reconQueries = (reconSearch.mock.calls as unknown as [string][]).map(
      (call) => call[0],
    );
    expect(reconQueries).toContain("Bank Umum Indonesia latest news");
    expect(reconQueries).toContain("Bank Mandiri news");

    const prompt = generateQueries.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain("Recent signals");
    expect(prompt).toContain("Bank Mandiri raises lending target");
  });

  it("assigns contiguous ranks in generation order", async () => {
    // Setup
    const { client, create } = makeClient(baseProfile);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: generateQueries as never,
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

  it("persists a query for every generated intent", async () => {
    // Setup
    const { client, create } = makeClient(baseProfile);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: generateQueries as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    const body = create.mock.calls[0]?.[0];
    const intents = new Set(
      body.queries.map((query: { intent: string }) => query.intent),
    );

    expect(intents.has("competitiveLandscape")).toBe(true);
    expect(intents.has("regulatoryPolicyWatch")).toBe(true);
    expect(intents.has("industryPulse")).toBe(true);
  });
});

describe("runQueryAnalysis — without a curated profile", () => {
  it("still generates queries, falling back to the IDX classification", async () => {
    // Setup
    const { client, create } = makeClient(null);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: generateQueries as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(true);
    const body = create.mock.calls[0]?.[0];
    expect(body.strategySnapshot.profile.present).toBe(false);
    expect(body.strategySnapshot.profile.competitors).toEqual([]);

    const prompt = generateQueries.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain(
      "Competitors: no curated profile for this issuer.",
    );
    expect(prompt).toContain("Keuangan");
  });

  it("makes no LLM call to discover competitors", async () => {
    // Setup
    const { client } = makeClient(null);
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: generateQueries as never,
    };

    // Act
    await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(generateQueries).toHaveBeenCalledTimes(1);
  });
});

describe("runQueryAnalysis — generation failure", () => {
  it("persists nothing and reports failure when the generation LLM call fails (leaving the prior set active)", async () => {
    // Setup
    const { client, create } = makeClient(baseProfile);
    const failingGenerateQueries = vi.fn().mockRejectedValue(new Error("boom"));
    const deps: RunQueryAnalysisDeps = {
      createClient: vi.fn(() => client) as never,
      generateQueries: failingGenerateQueries as never,
    };

    // Act
    const result = await runQueryAnalysis(makeContext() as never, deps);

    // Assert
    expect(result.success).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
