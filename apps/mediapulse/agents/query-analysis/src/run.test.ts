/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

import { queryAnalysisConfigSchema } from "./config-schema";

const { mockGet, mockCreate, mockFetchQueryLlm, mockFetchWildcard } =
  vi.hoisted(() => ({
    mockGet: vi.fn(),
    mockCreate: vi.fn(),
    mockFetchQueryLlm: vi.fn(),
    mockFetchWildcard: vi.fn(),
  }));

vi.mock("@mediapulse/env/agents-query-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
  },
}));

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    queryAnalysis: {
      get: mockGet,
      create: mockCreate,
    },
  })),
}));

vi.mock("./llm-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./llm-queries")>();
  return {
    ...actual,
    fetchLlmQueryCandidatesByPersona: mockFetchQueryLlm,
    fetchWildcardCandidates: mockFetchWildcard,
    fetchBrainstormBullets: vi.fn(),
  };
});

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { buildDeterministicQueries } from "./templates/build-deterministic-queries";
import {
  clampPerPersonaQuotaCount,
  computeWildcardCount,
  runQueryAnalysis,
} from "./run";

const ctxResponse = {
  ticker: {
    id: "22222222-2222-4222-a222-222222222222",
    symbol: "ABC",
    name: "ABC Ltd",
    metadata: null as null,
  },
  topEntities: [] as [],
  recentThemes: [] as [],
  peers: [] as [],
  calendar: { recentEventTypes: [] as string[] },
  headlineSamples: [] as [],
  kgNeighborhood: [] as [],
};

const baseConfig = queryAnalysisConfigSchema.parse({ openaiApiKey: "sk" });

describe("query-analysis run", () => {
  beforeEach(async () => {
    mockGet.mockReset();
    mockCreate.mockReset();
    mockFetchQueryLlm.mockReset();
    mockFetchWildcard.mockReset();

    mockFetchWildcard.mockResolvedValue([]);

    const { fetchBrainstormBullets } = await import("./llm-queries");
    vi.mocked(fetchBrainstormBullets).mockReset();

    mockGet.mockResolvedValue(ctxResponse);
    mockCreate.mockResolvedValue({
      created: 3,
      createdSetId: "33333333-3333-4333-a333-333333333333",
      activeSetId: "44444444-4444-4444-a444-444444444444",
    });
    mockFetchQueryLlm.mockResolvedValue([
      { text: "LLM extra", intent: "kg_change" as const, persona: "analyst" },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildDeterministicQueries", () => {
    it("creates deterministic baseline queries from default-v1 pack", () => {
      // Act
      const queries = buildDeterministicQueries(ctxResponse, {
        pack: "default-v1",
      });

      // Assert
      expect(queries.length).toBe(5);
      expect(queries[0]?.text).toContain("ABC");
      expect(queries.some((query) => query.intent === "fundamental")).toBe(
        true,
      );
    });
  });

  it("calls create with agentJobId when Hermes job id is present", async () => {
    // Act
    await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: baseConfig,
      token: "Bearer t",
      hermesCorrelation: { jobId: "job-abc" },
    });

    // Assert
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ agentJobId: "job-abc" }),
    );
  });

  it("returns llmPromptFingerprint on success details", async () => {
    const result = await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: baseConfig,
      token: "Bearer t",
    });

    expect(result.success).toBe(true);
    if (result.success && result.details) {
      expect(
        typeof (result.details as { llmPromptFingerprint?: string })
          .llmPromptFingerprint,
      ).toBe("string");
      expect(
        (result.details as { llmPromptFingerprint: string })
          .llmPromptFingerprint,
      ).toHaveLength(16);
    }
  });

  it("omits agentJobId when correlation is absent", async () => {
    // Act
    await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: baseConfig,
      token: "Bearer t",
    });

    // Assert
    const calls = mockCreate.mock.calls;
    const payload = calls[calls.length - 1]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload).toBeDefined();
    expect(Object.keys(payload as Record<string, unknown>)).not.toContain(
      "agentJobId",
    );
  });

  it("continues with deterministic merge when LLM throws", async () => {
    // Setup
    mockFetchQueryLlm.mockRejectedValue(new Error("LLM down"));

    // Act
    const result = await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: baseConfig,
      token: "Bearer t",
    });

    // Assert
    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
    const createCalls = mockCreate.mock.calls;
    const queries = (
      createCalls[createCalls.length - 1]?.[0] as {
        queries: { source: string }[];
      }
    ).queries;
    expect(queries.every((q) => q.source === "deterministic")).toBe(true);
  });

  it("passes useBrainstormPass through to the LLM orchestrator", async () => {
    const { fetchBrainstormBullets } = await import("./llm-queries");
    const fetchBrainstormBulletsMock = vi.mocked(fetchBrainstormBullets);
    fetchBrainstormBulletsMock.mockResolvedValue(["angle"]);

    // Act
    const result = await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: queryAnalysisConfigSchema.parse({
        openaiApiKey: "sk",
        useBrainstormPass: true,
      }),
      token: "Bearer t",
    });

    // Assert
    expect(result.success).toBe(true);
    expect(fetchBrainstormBulletsMock).toHaveBeenCalledTimes(1);
    expect(mockFetchQueryLlm).toHaveBeenCalledWith(
      expect.objectContaining({ brainstormBullets: ["angle"] }),
      expect.anything(),
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        queries: expect.arrayContaining([
          expect.objectContaining({ text: "LLM extra", intent: "kg_change" }),
        ]),
      }),
    );
  });

  it("defaults useBrainstormPass to false in the LLM orchestrator", async () => {
    const { fetchBrainstormBullets } = await import("./llm-queries");
    const fetchBrainstormBulletsMock = vi.mocked(fetchBrainstormBullets);

    // Act
    await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: baseConfig,
      token: "Bearer t",
    });

    // Assert
    expect(fetchBrainstormBulletsMock).not.toHaveBeenCalled();
    expect(mockFetchQueryLlm).toHaveBeenCalledWith(
      expect.objectContaining({ brainstormBullets: undefined }),
      expect.anything(),
    );
  });

  it("fires one diversity-gate broaden regenerate when the first batch is near-identical", async () => {
    const lowDiversityBatch = Array.from({ length: 10 }, () => ({
      text: "ABC latest news",
      intent: "breaking" as const,
      persona: "analyst",
    }));
    mockFetchQueryLlm
      .mockResolvedValueOnce(lowDiversityBatch)
      .mockResolvedValueOnce([
        {
          text: "ABC supply chain risk Q2",
          intent: "supply_chain" as const,
          persona: "retail",
        },
      ]);

    await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: queryAnalysisConfigSchema.parse({
        openaiApiKey: "sk",
        diversityGate: { enabled: true, threshold: 0.6 },
      }),
      token: "Bearer t",
    });

    expect(mockFetchQueryLlm).toHaveBeenCalledTimes(2);
    const secondCall = mockFetchQueryLlm.mock.calls[1]?.[0] as {
      broadenSystemNudge?: string;
    };
    expect(secondCall.broadenSystemNudge).toContain("diversity");
    expect(secondCall.broadenSystemNudge).toContain("Vary phrasing");

    const createPayload = mockCreate.mock.calls.at(-1)?.[0] as {
      strategySnapshot: {
        diversityScore?: { composite: number };
        diversityGate?: { diversityRegenerateFired: boolean };
      };
    };
    expect(createPayload.strategySnapshot.diversityScore).toBeDefined();
    expect(
      createPayload.strategySnapshot.diversityGate?.diversityRegenerateFired,
    ).toBe(true);
  });

  it("persists wildcardFraction budget as wildcard intent rows", async () => {
    mockFetchQueryLlm.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        text: `Standard LLM ${String(index + 1)}`,
        intent: "breaking" as const,
        persona: "analyst",
      })),
    );
    mockFetchWildcard.mockResolvedValue([
      { text: "Wildcard lateral angle A", intent: "wildcard" as const },
      { text: "Wildcard lateral angle B", intent: "wildcard" as const },
    ]);

    await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: queryAnalysisConfigSchema.parse({
        openaiApiKey: "sk",
        queryCount: 10,
        wildcardFraction: 0.2,
        minDeterministicCount: 0,
      }),
      token: "Bearer t",
    });

    expect(mockFetchWildcard).toHaveBeenCalledTimes(1);
    const createPayload = mockCreate.mock.calls.at(-1)?.[0] as {
      queries: Array<{ intent: string }>;
    };
    const wildcardRows = createPayload.queries.filter(
      (row) => row.intent === "wildcard",
    );
    expect(wildcardRows).toHaveLength(2);
    expect(createPayload.queries).toHaveLength(10);
  });

  it("distributes queryCount across language quotas into locale-specific rows", async () => {
    mockFetchQueryLlm.mockResolvedValue([]);

    await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: queryAnalysisConfigSchema.parse({
        openaiApiKey: "sk",
        queryCount: 10,
        wildcardFraction: 0,
        personas: [],
        languageQuotas: [
          { language: "en", share: 0.6 },
          { language: "id", share: 0.4 },
        ],
      }),
      token: "Bearer t",
    });

    const createPayload = mockCreate.mock.calls.at(-1)?.[0] as {
      queries: Array<{ text: string }>;
      strategySnapshot: {
        languageQuotas: Array<{ language: string; share: number }>;
      };
    };

    expect(createPayload.queries).toHaveLength(10);
    expect(createPayload.strategySnapshot.languageQuotas).toEqual([
      { language: "en", share: 0.6 },
      { language: "id", share: 0.4 },
    ]);

    const indonesianPattern =
      /berita terbaru|laporan keuangan|prospek saham|perubahan relasi|update regulasi/i;

    const englishSlice = createPayload.queries.slice(0, 6);
    const indonesianSlice = createPayload.queries.slice(6);

    expect(englishSlice).toHaveLength(6);
    expect(indonesianSlice).toHaveLength(4);
    expect(englishSlice.every((row) => !indonesianPattern.test(row.text))).toBe(
      true,
    );
    expect(
      indonesianSlice.every((row) => indonesianPattern.test(row.text)),
    ).toBe(true);
  });

  it("boosts fundamental intent weight in snapshot when earnings are within 14 days", async () => {
    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    mockGet.mockResolvedValue({
      ...ctxResponse,
      calendar: {
        recentEventTypes: [],
        nextEarningsAt: fiveDaysFromNow.toISOString(),
      },
    });

    await runQueryAnalysis({
      input: { tickerId: "22222222-2222-4222-a222-222222222222" },
      config: queryAnalysisConfigSchema.parse({
        openaiApiKey: "sk",
        wildcardFraction: 0,
      }),
      token: "Bearer t",
    });

    const createPayload = mockCreate.mock.calls.at(-1)?.[0] as {
      strategySnapshot: {
        intentWeights: { fundamental: number };
        appliedEventBias?: {
          firedRuleIds: string[];
          multipliers: { fundamental?: number };
        };
      };
    };
    expect(createPayload.strategySnapshot.intentWeights.fundamental).toBe(
      DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS.fundamental * 2,
    );
    expect(
      createPayload.strategySnapshot.appliedEventBias?.firedRuleIds,
    ).toContain("near-earnings");
    expect(
      createPayload.strategySnapshot.appliedEventBias?.multipliers.fundamental,
    ).toBe(2);
  });
});

describe("clampPerPersonaQuotaCount", () => {
  it("returns configured quota when fan-out is within the guard", () => {
    expect(clampPerPersonaQuotaCount(3, 3, 10)).toBe(3);
  });

  it("clamps quota when fan-out exceeds queryCount * 3", () => {
    expect(clampPerPersonaQuotaCount(3, 10, 5)).toBe(5);
  });
});

describe("computeWildcardCount", () => {
  it("rounds queryCount times wildcardFraction", () => {
    expect(computeWildcardCount(10, 0.2)).toBe(2);
    expect(computeWildcardCount(10, 0.1)).toBe(1);
    expect(computeWildcardCount(10, 0)).toBe(0);
  });
});
