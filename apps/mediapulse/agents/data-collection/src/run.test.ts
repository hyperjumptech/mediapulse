/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunContext } from "@workspace/agent-runtime";

import type { BodySchemaType } from "./utilities/body-schema";
import {
  dataCollectionAgentConfigSchema,
  type ConfigSchemaType,
} from "./utilities/config-schema";
import type {
  FetchedWebSearchResult,
  WebFetchDeps,
  WebFetchFailure,
  WebFetchOutcome,
  WebSearchResult,
} from "@workspace/agent-ingestion";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

/** Article-like body that passes the content quality gate. */
const validArticleContent = [
  "Bank Central Asia announced strategic expansion plans across regional markets.",
  "The company reported improved margins, higher loan growth, and stronger risk controls.",
  ...Array.from(
    { length: 90 },
    (_, index) =>
      `Analyst note ${index} discusses lending trends and deposit growth in Indonesia.`,
  ),
].join(" ");

const validArticleTitle = "Bank Central Asia expands regional operations";

/** Builds a long off-topic article body that passes the content quality gate. */
const longOffTopicArticle = (lead: string): string =>
  [
    lead,
    ...Array.from(
      { length: 90 },
      (_, index) =>
        `Unrelated detail ${index} covers global technology vendor commentary.`,
    ),
  ].join(" ");

const baseConfig = dataCollectionAgentConfigSchema.parse({
  web_search: [{ provider: "serper", apiKey: "serper-key" }],
  web_search_locales: [{ gl: "id", hl: "id" }],
  web_fetch: [{ provider: "serper", apiKey: "serper-key" }],
  relevance: {
    apiKey: "ai-key",
    model: "test-model",
    baseUrl: "https://ai.example",
  },
  collection: {
    targetSavedSources: 1,
    maxRounds: 3,
    startupJitterMs: 0,
  },
});

/**
 * Merges collection config overrides onto the shared run test baseline.
 *
 * @param overrides - Partial collection config fields to override.
 */
const withTestConfig = (
  overrides: {
    collection?: Partial<ConfigSchemaType["collection"]>;
  } = {},
): ConfigSchemaType =>
  dataCollectionAgentConfigSchema.parse({
    web_search: baseConfig.web_search,
    web_search_locales: baseConfig.web_search_locales,
    web_fetch: baseConfig.web_fetch,
    relevance: baseConfig.relevance,
    collection: { ...baseConfig.collection, ...overrides.collection },
  });

const searchSuccessPage = {
  url: "http://example.com",
  title: validArticleTitle,
  content: "Snippet",
  tickerId: TICKER_ID,
  searchQueryId: "sq-1",
  searchQueryText: "test query",
  serpIndex: 0,
};

/**
 * Builds a successful web-fetch outcome for run-level mocks.
 *
 * @param data - Fetched page fields returned by the mock provider chain.
 */
const mockFetchSuccess = (
  data: Omit<FetchedWebSearchResult, "provider"> &
    Partial<Pick<FetchedWebSearchResult, "provider">>,
): WebFetchOutcome => ({
  success: { provider: "jina", ...data },
  failures: [],
});

/**
 * Builds a failed web-fetch outcome for run-level mocks.
 *
 * @param failure - Failure fields for the mocked provider attempt.
 */
const mockFetchFailure = (
  failure: Omit<WebFetchFailure, "provider"> &
    Partial<Pick<WebFetchFailure, "provider">>,
): WebFetchOutcome => ({
  success: null,
  failures: [{ provider: "jina", ...failure }],
});

/**
 * Mirrors the real performWebFetch streaming contract in tests: invokes the
 * `onOutcome` hook for each outcome (so per-URL persistence runs in run.ts)
 * before resolving with the full outcome list.
 *
 * @param outcomes - Fetch outcomes the mocked call should stream and return.
 */
const fetchYielding =
  (outcomes: WebFetchOutcome[]) =>
  async (
    _searchResults: WebSearchResult[],
    deps: WebFetchDeps,
  ): Promise<WebFetchOutcome[]> => {
    for (const outcome of outcomes) {
      await deps.onOutcome?.(outcome);
    }

    return outcomes;
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
const deadUrlsLookupMock = vi.fn();
const deadUrlsRecordMock = vi.fn();
const runCreateMock = vi.fn();
const failureCreateMock = vi.fn();
const analysisGetMock = vi.fn();
const tickerGetMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    dataCollection: {
      get: getMock,
      create: createMock,
    },
    dataCollectionExistingUrls: {
      create: existingUrlsCreateMock,
    },
    dataCollectionDeadUrlsLookup: {
      create: deadUrlsLookupMock,
    },
    dataCollectionDeadUrlsRecord: {
      create: deadUrlsRecordMock,
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
    ticker: {
      get: tickerGetMock,
    },
  })),
}));

vi.mock("./utilities/web-search", () => ({
  performWebSearch: vi.fn(),
}));

vi.mock("@workspace/agent-ingestion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/agent-ingestion")>();
  return {
    ...actual,
    performWebFetch: vi.fn(),
  };
});

import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { performWebFetch } from "@workspace/agent-ingestion";
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
    vi.mocked(performWebFetch).mockImplementation(
      fetchYielding([
        mockFetchSuccess({
          ...searchSuccessPage,
          content: validArticleContent,
        }),
      ]),
    );
    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });
    createMock.mockResolvedValue("{}");
    existingUrlsCreateMock.mockResolvedValue({
      existingUrls: [],
      hostCounts: {},
    });
    deadUrlsLookupMock.mockResolvedValue({ deadUrls: [] });
    deadUrlsRecordMock.mockResolvedValue({
      message: "Dead URLs recorded",
      recordedCount: 0,
    });
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
    tickerGetMock.mockResolvedValue({
      id: TICKER_ID,
      symbol: "BBCA",
      name: "Bank Central Asia",
      aliases: ["BCA"],
      sector: "Keuangan",
      industry: "Perbankan",
      subSector: "Bank",
      subIndustry: "Bank",
      businessActivity: "Jasa Perbankan",
      peers: [{ symbol: "BBRI", name: "Bank Rakyat Indonesia Tbk" }],
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
            targetSavedSources: 1,
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
        title: validArticleTitle,
        content: validArticleContent,
        tickerId: TICKER_ID,
        searchQueryId: "sq-1",
        source: "Example",
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
      hostCounts: {},
    });
    vi.mocked(performWebFetch).mockImplementationOnce(fetchYielding([]));

    const result = await runDataCollection(
      createContext({
        config: withTestConfig(),
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

  it("skips web fetch for URLs returned by dead-url lookup", async () => {
    const searchHits = Array.from({ length: 10 }, (_, index) => ({
      success: true as const,
      data: {
        ...searchSuccessPage,
        url: `http://example.com/page-${index}`,
      },
    }));
    vi.mocked(performWebSearch).mockResolvedValueOnce(searchHits);
    deadUrlsLookupMock.mockResolvedValueOnce({
      deadUrls: ["http://example.com/page-0", "http://example.com/page-1"],
    });
    vi.mocked(performWebFetch).mockImplementationOnce(fetchYielding([]));

    const result = await runDataCollection(
      createContext({
        config: withTestConfig(),
      }),
    );

    expect(result.success).toBe(true);
    expect(deadUrlsLookupMock).toHaveBeenCalledWith({
      tickerId: TICKER_ID,
      urls: expect.arrayContaining([
        "http://example.com/page-0",
        "http://example.com/page-9",
      ]),
    });
    expect(performWebFetch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ url: "http://example.com/page-2" }),
      ]),
      expect.anything(),
    );
    expect(vi.mocked(performWebFetch).mock.calls[0]?.[0]).toHaveLength(8);
    expect(result.details?.summary).toMatchObject({
      droppedByDeadUrlCache: 2,
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("records 404 fetch failures to the dead-url cache", async () => {
    vi.mocked(performWebFetch).mockImplementationOnce(
      fetchYielding([
        mockFetchFailure({
          url: "http://failed.com",
          queryId: "sq-1",
          tickerId: TICKER_ID,
          errorCategory: "provider_http_error",
          message: "404 Not Found",
          retryable: false,
          httpStatus: 404,
        }),
      ]),
    );

    await runDataCollection(
      createContext({
        config: withTestConfig(),
      }),
    );

    expect(deadUrlsRecordMock).toHaveBeenCalledWith([
      expect.objectContaining({
        tickerId: TICKER_ID,
        url: "http://failed.com",
        errorCategory: "provider_http_error",
        httpStatus: 404,
      }),
    ]);
  });

  it("drops stale and far-future pages via the freshness gate", async () => {
    const fixedNow = new Date("2026-05-21T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    try {
      const isoDaysAgo = (days: number): string =>
        new Date(fixedNow.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const isoDaysAhead = (days: number): string =>
        new Date(fixedNow.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      vi.mocked(performWebSearch).mockResolvedValueOnce([
        {
          success: true,
          data: { ...searchSuccessPage, url: "http://example.com/fresh" },
        },
        {
          success: true,
          data: { ...searchSuccessPage, url: "http://example.com/stale" },
        },
        {
          success: true,
          data: { ...searchSuccessPage, url: "http://example.com/unknown" },
        },
        {
          success: true,
          data: { ...searchSuccessPage, url: "http://example.com/future" },
        },
      ]);

      vi.mocked(performWebFetch).mockImplementationOnce(
        fetchYielding([
          mockFetchSuccess({
            ...searchSuccessPage,
            url: "http://example.com/fresh",
            content: validArticleContent,
            fetchMetadata: { publishedTime: isoDaysAgo(2) },
          }),
          mockFetchSuccess({
            ...searchSuccessPage,
            url: "http://example.com/stale",
            content: validArticleContent,
            fetchMetadata: { publishedTime: isoDaysAgo(30) },
          }),
          mockFetchSuccess({
            ...searchSuccessPage,
            url: "http://example.com/unknown",
            content: validArticleContent,
          }),
          mockFetchSuccess({
            ...searchSuccessPage,
            url: "http://example.com/future",
            content: validArticleContent,
            fetchMetadata: { publishedTime: isoDaysAhead(5) },
          }),
        ]),
      );

      const result = await runDataCollection(
        createContext({
          config: withTestConfig(),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.details?.summary).toMatchObject({
        droppedByFreshness: 2,
        fetchSuccess: 2,
      });

      expect(createMock).toHaveBeenCalledTimes(2);
      expect(createMock).toHaveBeenCalledWith([
        expect.objectContaining({
          url: "http://example.com/fresh",
          publishedAt: isoDaysAgo(2),
        }),
      ]);
      expect(createMock).toHaveBeenCalledWith([
        expect.objectContaining({ url: "http://example.com/unknown" }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not call dataCollection.create when there are no fetch successes", async () => {
    // Setup
    vi.mocked(performWebFetch).mockImplementationOnce(fetchYielding([]));

    // Act
    await runDataCollection(
      createContext({
        config: withTestConfig(),
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
    vi.mocked(performWebFetch).mockImplementationOnce(
      fetchYielding([
        mockFetchFailure({
          url: "http://failed.com",
          queryId: "sq-1",
          tickerId: TICKER_ID,
          errorCategory: "provider_http_error",
          message: "404 Not Found",
          retryable: false,
          httpStatus: 404,
        }),
      ]),
    );

    // Act
    const result = await runDataCollection(
      createContext({
        config: withTestConfig(),
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

  it("reports a successful run with zero sources when search and fetch are empty", async () => {
    // Setup — the internal run policy does not fail on zero success.
    vi.mocked(performWebSearch).mockResolvedValue([]);
    vi.mocked(performWebFetch).mockImplementation(fetchYielding([]));

    // Act
    const result = await runDataCollection(createContext());

    // Assert
    expect(result).toMatchObject({
      success: true,
      details: {
        summary: {
          totalSources: 0,
          status: "success",
          searchSuccess: 0,
          fetchSuccess: 0,
        },
      },
    });
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
      }),
    );
  });

  it("drops noisy quote URLs before fetch and persists nothing", async () => {
    // Setup
    vi.mocked(performWebSearch).mockResolvedValue([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://finance.yahoo.com/quote/BBCA.JK/",
        },
      },
    ]);
    vi.mocked(performWebFetch).mockImplementation(fetchYielding([]));

    // Act
    const result = await runDataCollection(createContext());

    // Assert
    expect(result.success).toBe(true);
    expect(performWebFetch).toHaveBeenCalledWith([], expect.anything());
    expect(createMock).not.toHaveBeenCalled();
  });

  it("drops off-topic, quality-gated, and clean pages with separate counters", async () => {
    // Setup
    const paywallContent = "!!! $$$ ### subscribe to read !!! $$$ ### ".repeat(
      25,
    );
    const offTopicContent = longOffTopicArticle(
      "Microsoft Q2 earnings beat analyst expectations across cloud segments.",
    );

    vi.mocked(performWebSearch).mockResolvedValueOnce([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://example.com/clean",
        },
      },
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://example.com/off-topic",
        },
      },
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://example.com/paywall",
        },
      },
    ]);
    vi.mocked(performWebFetch).mockImplementationOnce(
      fetchYielding([
        mockFetchSuccess({
          ...searchSuccessPage,
          url: "https://example.com/clean",
          title: validArticleTitle,
          content: validArticleContent,
        }),
        mockFetchSuccess({
          ...searchSuccessPage,
          url: "https://example.com/off-topic",
          title: "Microsoft earnings headline here",
          content: offTopicContent,
        }),
        mockFetchSuccess({
          ...searchSuccessPage,
          url: "https://example.com/paywall",
          title: "Premium article headline here",
          content: paywallContent,
        }),
      ]),
    );

    // Act
    const result = await runDataCollection(
      createContext({
        config: withTestConfig(),
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith([
      expect.objectContaining({
        url: "https://example.com/clean",
        title: validArticleTitle,
      }),
    ]);
    expect(mockRunLog.info).toHaveBeenCalledWith(
      expect.objectContaining({
        droppedByContentQuality: expect.objectContaining({
          content_access_gated: 1,
        }),
        droppedByRelevance: 1,
      }),
      "web fetch stage finished",
    );
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        counters: expect.objectContaining({
          droppedByRelevance: 1,
        }),
      }),
    );
  });

  it("tracks per-rule quality counters and persists only clean sources", async () => {
    // Setup
    const paywallContent = "!!! $$$ ### subscribe to read !!! $$$ ### ".repeat(
      25,
    );
    const soft404Content = `Sorry, page not found. ${"x".repeat(200)}`;
    const shortContent = "word ".repeat(50);

    vi.mocked(performWebSearch).mockResolvedValueOnce([
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://example.com/clean",
        },
      },
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://example.com/paywall",
        },
      },
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://example.com/soft-404",
        },
      },
      {
        success: true,
        data: {
          ...searchSuccessPage,
          url: "https://example.com/short",
        },
      },
    ]);
    vi.mocked(performWebFetch).mockImplementationOnce(
      fetchYielding([
        mockFetchSuccess({
          ...searchSuccessPage,
          url: "https://example.com/clean",
          title: validArticleTitle,
          content: validArticleContent,
        }),
        mockFetchSuccess({
          ...searchSuccessPage,
          url: "https://example.com/paywall",
          title: "Premium article headline here",
          content: paywallContent,
        }),
        mockFetchSuccess({
          ...searchSuccessPage,
          url: "https://example.com/soft-404",
          title: "Missing article headline here",
          content: soft404Content,
        }),
        mockFetchSuccess({
          ...searchSuccessPage,
          url: "https://example.com/short",
          title: "Valid headline for short body",
          content: shortContent,
        }),
      ]),
    );

    // Act
    const result = await runDataCollection(
      createContext({
        config: withTestConfig(),
      }),
    );

    // Assert
    expect(result.success).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith([
      expect.objectContaining({
        url: "https://example.com/clean",
        title: validArticleTitle,
      }),
    ]);
    expect(mockRunLog.info).toHaveBeenCalledWith(
      expect.objectContaining({
        droppedByContentQuality: {
          content_no_title: 0,
          content_soft_404: 1,
          content_access_gated: 1,
          content_too_short: 1,
          content_repetitive: 0,
          content_link_farm: 0,
          content_index_like: 0,
        },
      }),
      "web fetch stage finished",
    );
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
    vi.mocked(performWebFetch).mockImplementationOnce(
      fetchYielding([
        mockFetchSuccess({
          ...searchSuccessPage,
          title: "Company profile and key statistics",
          url: "https://example.com/stocks",
          content: `Financial summary and key statistics with market cap details. ${Array.from({ length: 120 }, (_, index) => `Detail paragraph ${index} covers regional lending trends.`).join(" ")}`,
        }),
      ]),
    );

    // Act
    const result = await runDataCollection(createContext());

    // Assert
    expect(result.success).toBe(true);
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
        config: withTestConfig(),
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
      .mockImplementationOnce(
        fetchYielding([
          mockFetchSuccess({
            ...searchSuccessPage,
            content: validArticleContent,
          }),
        ]),
      )
      .mockImplementationOnce(
        fetchYielding([
          mockFetchSuccess({
            ...searchSuccessPage,
            content: validArticleContent,
          }),
        ]),
      );

    // Act
    const result = await runDataCollection(
      createContext({
        config: withTestConfig({
          collection: {
            targetSavedSources: 2,
            maxRounds: 3,
          },
        }),
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
    vi.mocked(performWebFetch).mockImplementation(fetchYielding([]));

    // Act
    const result = await runDataCollection(
      createContext({
        config: withTestConfig({
          collection: { targetSavedSources: 5 },
        }),
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
    vi.mocked(performWebFetch).mockImplementation(
      fetchYielding([
        mockFetchSuccess({
          ...searchSuccessPage,
          content: validArticleContent,
        }),
      ]),
    );

    // Act
    const result = await runDataCollection(
      createContext({
        config: withTestConfig({
          collection: {
            targetSavedSources: 10,
            maxRounds: 3,
          },
        }),
      }),
    );

    // Assert
    expect(performWebSearch).toHaveBeenCalledTimes(3);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("max_rounds_reached");
  });

  it("fetches all hygiene-surviving candidates without a per-query cap", async () => {
    // Setup: 4 queries × 3 hits each = 12 total candidates
    const queryIds = ["sq-1", "sq-2", "sq-3", "sq-4"];
    const searchHits = queryIds.flatMap((searchQueryId, queryIndex) =>
      Array.from({ length: 3 }, (_, hitIndex) => ({
        success: true as const,
        data: {
          url: `https://example.com/q${queryIndex}-h${hitIndex}`,
          title: validArticleTitle,
          content: "Snippet",
          tickerId: TICKER_ID,
          searchQueryId,
          searchQueryText: `query-${queryIndex}`,
          serpIndex: hitIndex,
        },
      })),
    );

    vi.mocked(performWebSearch).mockResolvedValueOnce(searchHits);
    vi.mocked(performWebFetch).mockImplementation((results, deps) => {
      const outcomes = results.map((page) =>
        mockFetchSuccess({
          ...page,
          content: validArticleContent,
        }),
      );

      return fetchYielding(outcomes)(results, deps);
    });

    // Act
    await runDataCollection(
      createContext({
        config: withTestConfig(),
      }),
    );

    // Assert: all 12 hygiene-surviving candidates are passed to fetch with no budget cap
    expect(performWebFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(performWebFetch).mock.calls[0]?.[0]).toHaveLength(12);
  });
});

describe("parallel fetch wall-clock", () => {
  it("fetches 12 URLs with concurrency 4 faster than sequential execution", async () => {
    // Setup
    const { performWebFetch: performWebFetchActual } = await vi.importActual<
      typeof import("@workspace/agent-ingestion")
    >("@workspace/agent-ingestion");

    const searchResults = Array.from({ length: 12 }, (_, index) => ({
      url: `http://example.com/${index}`,
      title: validArticleTitle,
      content: "Snippet",
      tickerId: TICKER_ID,
      searchQueryId: `sq-${index}`,
      searchQueryText: "test query",
      serpIndex: index,
    }));

    const postMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        statusCode: 200,
        body: JSON.stringify({
          data: {
            url: "http://example.com/page",
            title: validArticleTitle,
            content: validArticleContent,
          },
        }),
      };
    });
    const fakeGot = { post: postMock };

    // Act
    const startedAt = Date.now();
    await performWebFetchActual(searchResults, {
      config: {
        providers: [
          {
            type: "jina",
            baseUrl: "https://fetch.example",
            authentication: { type: "bearer" as const },
            rateLimit: { requests: 12, perSeconds: 1 },
            concurrency: 4,
          },
        ],
      },
      gotClient: fakeGot as never,
      logger: { info: vi.fn(), warn: vi.fn() },
    });
    const elapsedMs = Date.now() - startedAt;

    // Assert — 12 × 50ms sequential would be 600ms; concurrency 4 targets ~150ms
    expect(elapsedMs).toBeLessThan((12 * 50) / 4 + 100);
  });
});
