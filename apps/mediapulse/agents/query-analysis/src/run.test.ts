/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryAnalysisConfigSchema } from "./config-schema";

const { mockGet, mockCreate, mockFetchLlm } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockCreate: vi.fn(),
  mockFetchLlm: vi.fn(),
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
    fetchLlmQueryCandidates: mockFetchLlm,
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
import { runQueryAnalysis } from "./run";

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
  beforeEach(() => {
    mockGet.mockReset();
    mockCreate.mockReset();
    mockFetchLlm.mockReset();

    mockGet.mockResolvedValue(ctxResponse);
    mockCreate.mockResolvedValue({
      created: 3,
      createdSetId: "33333333-3333-4333-a333-333333333333",
      activeSetId: "44444444-4444-4444-a444-444444444444",
    });
    mockFetchLlm.mockResolvedValue([
      { text: "LLM extra", intent: "kg_change" as const },
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
    mockFetchLlm.mockRejectedValue(new Error("LLM down"));

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
});
