/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryAnalysisConfigSchema } from "./config-schema";

const { mockGet, mockCreate, mockFetchQueryLlm } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockCreate: vi.fn(),
  mockFetchQueryLlm: vi.fn(),
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
import { clampPerPersonaQuotaCount, runQueryAnalysis } from "./run";

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
});

describe("clampPerPersonaQuotaCount", () => {
  it("returns configured quota when fan-out is within the guard", () => {
    expect(clampPerPersonaQuotaCount(3, 3, 10)).toBe(3);
  });

  it("clamps quota when fan-out exceeds queryCount * 3", () => {
    expect(clampPerPersonaQuotaCount(3, 10, 5)).toBe(5);
  });
});
