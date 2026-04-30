/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunContext } from "@workspace/agent-runtime";

import type { BodySchemaType } from "./utilities/body-schema";
import type { ConfigSchemaType } from "./utilities/config-schema";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

const baseConfig = {
  webSearch: {
    baseUrl: "https://search.example",
    authentication: { type: "bearer" as const },
    rateLimit: { requests: 1, perSeconds: 1 },
  },
  webFetch: {
    baseUrl: "https://fetch.example",
    authentication: { type: "bearer" as const },
    rateLimit: { requests: 1, perSeconds: 1 },
  },
  targetDailySuccessfulSources: 1,
  maxRefillRounds: 3,
} satisfies ConfigSchemaType;

const searchSuccessPage = {
  url: "http://example.com",
  title: "Test",
  content: "Snippet",
  tickerId: TICKER_ID,
  searchQueryId: "sq-1",
  searchQueryText: "test query",
};

vi.mock("@mediapulse/env/agents-data-collection", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
  },
}));

const { mockRunLog } = vi.hoisted(() => ({
  mockRunLog: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@workspace/logger", () => ({
  logger: {
    child: vi.fn(() => mockRunLog),
  },
}));

const getMock = vi.fn();
const createMock = vi.fn();
const existingUrlsCreateMock = vi.fn();
const runCreateMock = vi.fn();
const failureCreateMock = vi.fn();
const analysisGetMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    dataCollection: {
      get: getMock,
      create: createMock,
    },
    dataCollectionExistingUrls: {
      create: existingUrlsCreateMock,
    },
    dataCollectionRun: {
      create: runCreateMock,
    },
    dataCollectionFailure: {
      create: failureCreateMock,
    },
    analysis: {
      get: analysisGetMock,
    },
  })),
}));

vi.mock("./utilities/web-search", () => ({
  performWebSearch: vi.fn(),
}));

vi.mock("./utilities/web-fetch", () => ({
  performWebFetch: vi.fn(),
}));

import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { performWebFetch } from "./utilities/web-fetch";
import { performWebSearch } from "./utilities/web-search";
import { runDataCollection } from "./run";

/**
 * Builds a minimal {@link AgentRunContext} for {@link runDataCollection}.
 *
 * @param overrides - Partial context to merge (e.g. `input` or `config`).
 */
function createContext(
  overrides?: Partial<AgentRunContext<BodySchemaType, ConfigSchemaType>>,
): AgentRunContext<BodySchemaType, ConfigSchemaType> {
  return {
    input: { tickerId: TICKER_ID },
    config: baseConfig,
    token: "Bearer test-token",
    ...overrides,
  };
}

describe("runDataCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(performWebSearch).mockResolvedValue([
      {
        success: true,
        data: searchSuccessPage,
      },
    ]);
    vi.mocked(performWebFetch).mockResolvedValue([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          content: "Main content",
        },
      },
    ]);
    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });
    createMock.mockResolvedValue("{}");
    existingUrlsCreateMock.mockResolvedValue({ existingUrls: [] });
    analysisGetMock.mockResolvedValue({
      dataSources: [],
      dataSourceTotalCount: 0,
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
      relevanceSelectionState: {
        utcDayStartIso: "2026-01-01T00:00:00.000Z",
        selectedCountToday: 0,
      },
      lastRelevanceScoredAtIso: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success summary and persists sources when search and fetch succeed", async () => {
    // Act
    const result = await runDataCollection(createContext());

    // Assert
    expect(result).toMatchObject({
      success: true,
      details: {
        summary: {
          totalSources: 1,
          status: "success",
          searchSuccess: 1,
          fetchSuccess: 1,
          refill: {
            roundsExecuted: 1,
            targetDailySuccessfulSources: 1,
            existingTodaySourceCount: 0,
            effectiveTodayCount: 1,
            stopReason: "daily_target_met",
          },
        },
      },
    });
    expect(createAgentDataApiClient).toHaveBeenCalledWith({
      baseUrl: "http://agent-data-api",
      version: "v1",
      token: "Bearer test-token",
    });
    expect(getMock).toHaveBeenCalledWith({ tickerId: TICKER_ID });
    expect(existingUrlsCreateMock).toHaveBeenCalledWith({
      tickerId: TICKER_ID,
      urls: ["http://example.com"],
    });
    expect(createMock).toHaveBeenCalledWith([
      {
        url: "http://example.com",
        title: "Test",
        content: "Main content",
        tickerId: TICKER_ID,
        searchQueryId: "sq-1",
      },
    ]);
    expect(failureCreateMock).not.toHaveBeenCalled();
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: TICKER_ID,
        status: "success",
        counters: expect.objectContaining({
          queriesTotal: 1,
          fetchSuccess: 1,
        }),
      }),
    );
  });

  it("skips web fetch for URLs already returned by dataCollectionExistingUrls", async () => {
    existingUrlsCreateMock.mockResolvedValueOnce({
      existingUrls: ["http://example.com"],
    });
    vi.mocked(performWebFetch).mockResolvedValueOnce([]);

    const result = await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          runPolicy: {
            minSuccessfulSources: 0,
            failOnZeroSuccess: false,
          },
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(existingUrlsCreateMock).toHaveBeenCalledWith({
      tickerId: TICKER_ID,
      urls: ["http://example.com"],
    });
    expect(performWebFetch).toHaveBeenCalledWith([], expect.anything());
    expect(createMock).not.toHaveBeenCalled();
  });

  it("passes time window fields to dataCollection.get when input includes timeWindow", async () => {
    // Setup
    const start = "2024-01-01T00:00:00.000Z";
    const end = "2024-01-02T00:00:00.000Z";

    // Act
    await runDataCollection(
      createContext({
        input: {
          tickerId: TICKER_ID,
          timeWindow: { start, end },
        },
      }),
    );

    // Assert
    expect(getMock).toHaveBeenCalledWith({
      tickerId: TICKER_ID,
      start,
      end,
    });
  });

  it("does not call dataCollection.create when there are no fetch successes", async () => {
    // Setup
    vi.mocked(performWebFetch).mockResolvedValueOnce([]);

    // Act
    await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          runPolicy: {
            minSuccessfulSources: 0,
            failOnZeroSuccess: false,
          },
        },
      }),
    );

    // Assert
    expect(createMock).not.toHaveBeenCalled();
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success" }),
    );
  });

  it("records partial_success and persists fetch failures", async () => {
    // Setup
    vi.mocked(performWebFetch).mockResolvedValueOnce([
      {
        success: false,
        url: "http://failed.com",
        queryId: "sq-1",
        tickerId: TICKER_ID,
        errorCategory: "provider_http_error",
        message: "404 Not Found",
        retryable: false,
        httpStatus: 404,
      },
    ]);

    // Act
    const result = await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          runPolicy: {
            minSuccessfulSources: 0,
            failOnZeroSuccess: false,
          },
        },
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.details?.summary).toMatchObject({
      status: "partial_success",
      totalSources: 0,
      fetchSuccess: 0,
    });
    expect(failureCreateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "web-fetch",
          errorCategory: "provider_http_error",
          httpStatus: 404,
        }),
      ]),
    );
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "partial_success",
      }),
    );
  });

  it("returns semantic failure when run policy requires successes but none were collected", async () => {
    // Setup
    vi.mocked(performWebSearch).mockResolvedValueOnce([]);
    vi.mocked(performWebFetch).mockResolvedValueOnce([]);

    // Act
    const result = await runDataCollection(createContext());

    // Assert — Hermes maps `success: false` to HTTP 200 + failure envelope (not 500), so pipeline UIs get the message
    expect(result).toMatchObject({
      success: false,
      message:
        "Data collection run failed: no sources were successfully collected, but the run policy requires at least 1 successful source.",
      details: {
        summary: {
          totalSources: 0,
          status: "failed",
          searchSuccess: 0,
          fetchSuccess: 0,
          refill: {
            roundsExecuted: 1,
          },
        },
        failureReason: "insufficient_successful_sources",
        requiredSuccessfulSources: 1,
        collectedSuccessfulSources: 0,
      },
    });
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });

  it("returns semantic failure when collected sources are below the policy minimum (non-zero)", async () => {
    // Setup
    vi.mocked(performWebSearch).mockResolvedValueOnce([
      {
        success: true,
        data: searchSuccessPage,
      },
    ]);
    vi.mocked(performWebFetch).mockResolvedValueOnce([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          content: "Main content",
        },
      },
    ]);

    // Act
    const result = await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          runPolicy: {
            minSuccessfulSources: 2,
            failOnZeroSuccess: true,
          },
        },
      }),
    );

    // Assert
    expect(result).toMatchObject({
      success: false,
      message:
        "Data collection run failed: only 1 successful source collected, but the run policy requires at least 2.",
      details: {
        summary: {
          totalSources: 1,
          status: "failed",
          searchSuccess: 1,
          fetchSuccess: 1,
          refill: {
            roundsExecuted: 1,
          },
        },
        failureReason: "insufficient_successful_sources",
        requiredSuccessfulSources: 2,
        collectedSuccessfulSources: 1,
      },
    });
  });

  it("drops noisy quote URLs before fetch and treats run as semantic failure when none remain", async () => {
    // Setup
    vi.mocked(performWebSearch).mockResolvedValueOnce([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://finance.yahoo.com/quote/BBCA.JK/",
        },
      },
    ]);
    vi.mocked(performWebFetch).mockResolvedValueOnce([]);

    // Act
    const result = await runDataCollection(createContext());

    // Assert
    expect(result.success).toBe(false);
    expect(performWebFetch).toHaveBeenCalledWith([], expect.anything());
  });

  it("drops index-like content after fetch and does not persist source", async () => {
    // Setup
    vi.mocked(performWebSearch).mockResolvedValueOnce([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          title: "Stock summary",
          url: "https://example.com/stocks",
        },
      },
    ]);
    vi.mocked(performWebFetch).mockResolvedValueOnce([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          title: "Company profile and key statistics",
          url: "https://example.com/stocks",
          content: `Financial summary and key statistics with market cap details. ${"data ".repeat(120)}`,
        },
      },
    ]);

    // Act
    const result = await runDataCollection(createContext());

    // Assert
    expect(result.success).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("skips refill rounds when daily target is already satisfied by existing data", async () => {
    // Setup
    analysisGetMock.mockResolvedValueOnce({
      dataSources: [],
      dataSourceTotalCount: 5,
      entityTypes: [],
      relationTypes: [],
      existingEntities: [],
      relevanceSelectionState: {
        utcDayStartIso: "2026-01-01T00:00:00.000Z",
        selectedCountToday: 0,
      },
      lastRelevanceScoredAtIso: null,
    });

    // Act
    const result = await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          runPolicy: { minSuccessfulSources: 0, failOnZeroSuccess: false },
        },
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(performWebSearch).not.toHaveBeenCalled();
    expect(
      (result.details?.summary as { refill?: { roundsExecuted: number } })
        .refill?.roundsExecuted,
    ).toBe(0);
  });

  it("runs refill rounds until target is met", async () => {
    // Setup
    vi.mocked(performWebSearch)
      .mockResolvedValueOnce([
        {
          success: true,
          data: searchSuccessPage,
        },
      ])
      .mockResolvedValueOnce([
        {
          success: true,
          data: searchSuccessPage,
        },
      ]);
    vi.mocked(performWebFetch)
      .mockResolvedValueOnce([
        {
          success: true,
          data: {
            ...searchSuccessPage,
            content: "Main content",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          success: true,
          data: {
            ...searchSuccessPage,
            content: "Main content",
          },
        },
      ]);

    // Act
    const result = await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          targetDailySuccessfulSources: 2,
          maxRefillRounds: 3,
        },
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(performWebSearch).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("daily_target_met");
  });

  it("stops refill when no progress is made in a round", async () => {
    // Setup
    vi.mocked(performWebSearch).mockResolvedValue([]);
    vi.mocked(performWebFetch).mockResolvedValue([]);

    // Act
    const result = await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          targetDailySuccessfulSources: 5,
          runPolicy: { minSuccessfulSources: 0, failOnZeroSuccess: false },
        },
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(performWebSearch).toHaveBeenCalledTimes(1);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("no_progress");
  });

  it("stops refill after max rounds when target remains unmet", async () => {
    // Setup
    vi.mocked(performWebSearch).mockResolvedValue([
      {
        success: true,
        data: searchSuccessPage,
      },
    ]);
    vi.mocked(performWebFetch).mockResolvedValue([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          content: "Main content",
        },
      },
    ]);

    // Act
    const result = await runDataCollection(
      createContext({
        config: {
          ...baseConfig,
          runPolicy: { minSuccessfulSources: 0, failOnZeroSuccess: false },
          targetDailySuccessfulSources: 10,
          maxRefillRounds: 3,
        },
      }),
    );

    // Assert
    expect(performWebSearch).toHaveBeenCalledTimes(4);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("max_rounds_reached");
  });
});
