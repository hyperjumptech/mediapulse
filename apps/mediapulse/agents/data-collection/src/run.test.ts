/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunContext } from "@workspace/agent-runtime";

import type { BodySchemaType } from "./utilities/body-schema";
import {
  dataCollectionAgentConfigSchema,
  type ConfigSchemaType,
} from "./utilities/config-schema";
import type { WebSearchResult } from "./utilities/web-search";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

const validTitle = "Bank Central Asia expands regional operations";

const baseConfig = dataCollectionAgentConfigSchema.parse({
  web_search: [{ provider: "serper", apiKey: "serper-key" }],
  web_search_locales: [{ gl: "id", hl: "id" }],
  web_fetch: [{ provider: "serper", apiKey: "serper-key" }],
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
    collection: { ...baseConfig.collection, ...overrides.collection },
  });

const searchHit: WebSearchResult = {
  url: "http://example.com",
  title: validTitle,
  content: "Snippet",
  tickerId: TICKER_ID,
  searchQueryId: "sq-1",
  searchQueryText: "test query",
  searchQueryIntent: "breaking",
  searchQueryRank: 1,
  serpIndex: 0,
};

/** Wraps a web-search result as a successful attempt. */
const success = (data: WebSearchResult) => ({ success: true as const, data });

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
const runCreateMock = vi.fn();
const failureCreateMock = vi.fn();
const outcomeCreateMock = vi.fn();
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
    dataCollectionRun: {
      create: runCreateMock,
    },
    dataCollectionFailure: {
      create: failureCreateMock,
    },
    collectionUrlOutcome: {
      create: outcomeCreateMock,
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

import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
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
    vi.mocked(performWebSearch).mockResolvedValue([success(searchHit)]);
    getMock.mockResolvedValue({
      data: [{ id: "sq-1", text: "test query", tickerId: TICKER_ID }],
    });
    createMock.mockResolvedValue("{}");
    existingUrlsCreateMock.mockResolvedValue({
      existingUrls: [],
      hostCounts: {},
    });
    deadUrlsLookupMock.mockResolvedValue({ deadUrls: [] });
    runCreateMock.mockResolvedValue({});
    failureCreateMock.mockResolvedValue({});
    outcomeCreateMock.mockResolvedValue({ message: "Success" });
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

  it("persists surviving search hits as descriptions with no fetch", async () => {
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
          persisted: 1,
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
    expect(createMock).toHaveBeenCalledWith([
      {
        url: "http://example.com",
        title: validTitle,
        description: "Snippet",
        tickerId: TICKER_ID,
        searchQueryId: "sq-1",
        source: "Example",
      },
    ]);
    const persistedInput = createMock.mock.calls[0]![0][0];
    expect(persistedInput).not.toHaveProperty("content");
    expect(runCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: TICKER_ID,
        status: "success",
        snapshot: expect.objectContaining({
          result: expect.objectContaining({ saved: 1 }),
        }),
      }),
    );
  });

  it("skips hits whose canonical URL already exists", async () => {
    existingUrlsCreateMock.mockResolvedValueOnce({
      existingUrls: ["http://example.com"],
      hostCounts: {},
    });

    const result = await runDataCollection(
      createContext({ config: withTestConfig() }),
    );

    expect(result.success).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("skips hits returned by the dead-url lookup", async () => {
    const searchHits = Array.from({ length: 10 }, (_, index) =>
      success({ ...searchHit, url: `http://example.com/page-${index}` }),
    );
    vi.mocked(performWebSearch).mockResolvedValueOnce(searchHits);
    deadUrlsLookupMock.mockResolvedValueOnce({
      deadUrls: ["http://example.com/page-0", "http://example.com/page-1"],
    });

    const result = await runDataCollection(
      createContext({ config: withTestConfig() }),
    );

    expect(result.success).toBe(true);
    expect(result.details?.summary).toMatchObject({
      droppedByDeadUrlCache: 2,
    });
    // 8 survivors persisted, first-round target is met after the first hit
    expect(createMock).toHaveBeenCalled();
    const persistedUrls = createMock.mock.calls.map((call) => call[0][0].url);
    expect(persistedUrls).not.toContain("http://example.com/page-0");
    expect(persistedUrls).not.toContain("http://example.com/page-1");
  });

  it("drops hits with an empty snippet as empty_description", async () => {
    vi.mocked(performWebSearch).mockResolvedValueOnce([
      success({
        ...searchHit,
        url: "http://example.com/blank",
        content: "   ",
      }),
    ]);

    const result = await runDataCollection(
      createContext({ config: withTestConfig() }),
    );

    expect(result.success).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
    expect(result.details?.summary).toMatchObject({
      droppedByEmptyDescription: 1,
      totalSources: 0,
    });
    expect(outcomeCreateMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: "dropped",
          reason: "empty_description",
        }),
      ]),
    );
  });

  it("drops stale and future-dated hits by publishedAt but keeps unknown-date hits", async () => {
    const fixedNow = new Date("2026-05-21T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    try {
      const isoDaysAgo = (days: number): string =>
        new Date(fixedNow.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const isoDaysAhead = (days: number): string =>
        new Date(fixedNow.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

      vi.mocked(performWebSearch).mockResolvedValueOnce([
        success({
          ...searchHit,
          url: "http://example.com/fresh",
          publishedAt: isoDaysAgo(2),
        }),
        success({
          ...searchHit,
          url: "http://example.com/stale",
          publishedAt: isoDaysAgo(30),
        }),
        success({ ...searchHit, url: "http://example.com/unknown" }),
        success({
          ...searchHit,
          url: "http://example.com/future",
          publishedAt: isoDaysAhead(5),
        }),
      ]);

      const result = await runDataCollection(
        createContext({
          config: withTestConfig({
            collection: { targetSavedSources: 5, maxRounds: 1 },
          }),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.details?.summary).toMatchObject({
        droppedByFreshness: 2,
        totalSources: 2,
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

  it("reports a successful run with zero sources when search is empty", async () => {
    vi.mocked(performWebSearch).mockResolvedValue([]);

    const result = await runDataCollection(createContext());

    expect(result).toMatchObject({
      success: true,
      details: {
        summary: {
          totalSources: 0,
          status: "success",
          searchSuccess: 0,
          persisted: 0,
        },
      },
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("drops noisy quote URLs before persisting", async () => {
    vi.mocked(performWebSearch).mockResolvedValue([
      success({
        ...searchHit,
        url: "https://finance.yahoo.com/quote/BBCA.JK/",
      }),
    ]);

    const result = await runDataCollection(createContext());

    expect(result.success).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("skips refill rounds when daily target is already satisfied by existing data", async () => {
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

    const result = await runDataCollection(
      createContext({ config: withTestConfig() }),
    );

    expect(result.success).toBe(true);
    expect(performWebSearch).not.toHaveBeenCalled();
    expect(
      (result.details?.summary as { refill?: { roundsExecuted: number } })
        .refill?.roundsExecuted,
    ).toBe(0);
  });

  it("runs refill rounds until target is met", async () => {
    vi.mocked(performWebSearch)
      .mockResolvedValueOnce([
        success({ ...searchHit, url: "http://example.com/a" }),
      ])
      .mockResolvedValueOnce([
        success({ ...searchHit, url: "http://example.com/b" }),
      ]);

    const result = await runDataCollection(
      createContext({
        config: withTestConfig({
          collection: { targetSavedSources: 2, maxRounds: 3 },
        }),
      }),
    );

    expect(result.success).toBe(true);
    expect(performWebSearch).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("daily_target_met");
  });

  it("caps persistence at the target within a single round", async () => {
    vi.mocked(performWebSearch).mockResolvedValue([
      success({ ...searchHit, url: "http://example.com/a" }),
      success({ ...searchHit, url: "http://example.com/b" }),
      success({ ...searchHit, url: "http://example.com/c" }),
      success({ ...searchHit, url: "http://example.com/d" }),
      success({ ...searchHit, url: "http://example.com/e" }),
    ]);

    const result = await runDataCollection(
      createContext({
        config: withTestConfig({
          collection: { targetSavedSources: 2, maxRounds: 3 },
        }),
      }),
    );

    expect(result.success).toBe(true);
    expect(performWebSearch).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("daily_target_met");
  });

  it("stops refill when no progress is made in a round", async () => {
    vi.mocked(performWebSearch).mockResolvedValue([]);

    const result = await runDataCollection(
      createContext({
        config: withTestConfig({ collection: { targetSavedSources: 5 } }),
      }),
    );

    expect(result.success).toBe(true);
    expect(performWebSearch).toHaveBeenCalledTimes(1);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("no_progress");
  });

  it("stops refill after max rounds when target remains unmet", async () => {
    vi.mocked(performWebSearch).mockResolvedValue([
      success({ ...searchHit, url: "http://example.com/loop" }),
    ]);

    const result = await runDataCollection(
      createContext({
        config: withTestConfig({
          collection: { targetSavedSources: 10, maxRounds: 3 },
        }),
      }),
    );

    expect(result.success).toBe(true);
    expect(performWebSearch).toHaveBeenCalledTimes(3);
    expect(
      (result.details?.summary as { refill?: { stopReason: string } }).refill
        ?.stopReason,
    ).toBe("max_rounds_reached");
  });
});
