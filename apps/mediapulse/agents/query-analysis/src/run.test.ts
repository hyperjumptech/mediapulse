/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentRunContext } from "@workspace/agent-runtime";

import type { QueryAnalysisConfig } from "./config-schema.js";
import type { QueryAnalysisInput } from "./input-schema.js";
import { runQueryAnalysis } from "./run.js";

const getMock = vi.fn();
const createMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    queryAnalysis: {
      get: getMock,
      create: createMock,
    },
  })),
}));

vi.mock("@mediapulse/env/agents-query-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
  },
}));

describe("runQueryAnalysis", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("persists merged deterministic queries when OpenAI is not configured", async () => {
    const configSnapshot = {
      queryCount: 6,
      allowedLanguages: ["en"],
      minDeterministicCount: 4,
      weightBreaking: 0.5,
      weightKgChange: 0.3,
      weightFundamental: 0.2,
      model: "gpt-test",
      maxTokens: 100,
    };

    getMock.mockResolvedValue({
      ticker: {
        id: "t1",
        symbol: "ACME",
        name: "Acme",
        metadata: null,
      },
      topEntities: [],
      recentThemes: [],
      configSnapshot,
      relationDeltas: [],
    });

    createMock.mockResolvedValue({
      created: 4,
      setId: "set-new",
      activeSetId: "set-new",
    });

    const ctx: AgentRunContext<QueryAnalysisInput, QueryAnalysisConfig> = {
      input: { tickerId: "t1" },
      config: {},
      token: "Bearer x",
    };

    const result = await runQueryAnalysis(ctx);

    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: "t1",
        generationSource: "hybrid_v1",
        activate: true,
      }),
    );
  });
});
