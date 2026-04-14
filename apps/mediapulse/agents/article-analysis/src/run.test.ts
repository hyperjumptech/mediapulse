/** @vitest-environment node */
import type { AgentRunContext } from "@workspace/agent-runtime";
import { logger } from "@workspace/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config, Input } from "./index";
import { run } from "./run";

const analysisGet = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    analysis: {
      get: analysisGet,
    },
  })),
}));

vi.mock("@mediapulse/env/agents-article-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://localhost:8081",
  },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/** Builds a minimal run context for tests. */
function runContext(overrides: {
  input: Input;
  config: Config;
  token?: string;
}): AgentRunContext<Input, Config> {
  return { ...overrides, token: overrides.token ?? "Bearer test" };
}

describe("run", () => {
  beforeEach(() => {
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.error).mockClear();
    analysisGet.mockReset();
  });

  it("returns success with source count when analysis GET succeeds", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [{ id: "ds-1" }, { id: "ds-2" }],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-1" },
        config: {},
      }),
    );

    expect(result).toEqual({
      success: true,
      message: "analysis context loaded (2 source(s))",
      details: {
        dataSourcesReturned: 2,
        dataSourcesSelected: 2,
        reanalyze: false,
      },
    });
    expect(analysisGet).toHaveBeenCalledWith({
      tickerId: "ticker-1",
      unanalyzed: true,
    });
  });

  it("uses unanalyzed false when reanalyze with maxBatchSize", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });

    await run(
      runContext({
        input: {
          tickerId: "ticker-r",
          reanalyze: true,
          maxBatchSize: 3,
        },
        config: {},
      }),
    );

    expect(analysisGet).toHaveBeenCalledWith({
      tickerId: "ticker-r",
      unanalyzed: false,
    });
  });

  it("passes timeWindow as start and end on GET", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });

    await run(
      runContext({
        input: {
          tickerId: "ticker-w",
          timeWindow: {
            start: "2026-01-01T00:00:00.000Z",
            end: "2026-01-31T00:00:00.000Z",
          },
        },
        config: {},
      }),
    );

    expect(analysisGet).toHaveBeenCalledWith({
      tickerId: "ticker-w",
      unanalyzed: true,
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-31T00:00:00.000Z",
    });
  });

  it("returns success when backlog is empty", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-2" },
        config: {},
      }),
    );

    expect(result).toEqual({
      success: true,
      message: "analysis context loaded (0 source(s))",
      details: {
        dataSourcesReturned: 0,
        dataSourcesSelected: 0,
        reanalyze: false,
      },
    });
  });

  it("reports batch cap when maxBatchSize is smaller than result set", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [
        {
          id: "b",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          url: "",
          title: "",
          content: "",
          tickerId: "t",
        },
        {
          id: "a",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          url: "",
          title: "",
          content: "",
          tickerId: "t",
        },
      ],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });

    const result = await run(
      runContext({
        input: { tickerId: "ticker-cap", maxBatchSize: 1 },
        config: {},
      }),
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe(
      "analysis context loaded (2 source(s), processing batch of 1)",
    );
    expect(result.details).toEqual({
      dataSourcesReturned: 2,
      dataSourcesSelected: 1,
      reanalyze: false,
    });
  });

  it("returns failure when analysis GET throws", async () => {
    analysisGet.mockRejectedValue(new Error("upstream error"));

    const result = await run(
      runContext({
        input: { tickerId: "ticker-3" },
        config: {},
      }),
    );

    expect(result).toEqual({
      success: false,
      message: "upstream error",
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it("logs when config.verbose is true", async () => {
    analysisGet.mockResolvedValue({
      dataSources: [],
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
    });

    await run(
      runContext({
        input: { tickerId: "t-verbose" },
        config: { verbose: true },
      }),
    );

    expect(logger.info).toHaveBeenCalledWith(
      { tickerId: "t-verbose" },
      "article-analysis run started",
    );
  });
});
