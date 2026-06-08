/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentRunContext } from "@workspace/agent-runtime";

import type { BodySchemaType } from "./utilities/body-schema";
import { ConfigSchema, type ConfigSchemaType } from "./utilities/config-schema";
import type {
  FetchedWebSearchResult,
  WebFetchFailure,
  WebFetchOutcome,
} from "@workspace/agent-ingestion";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const CURATED_QUERY_ID = "22222222-2222-4222-a222-222222222222";

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

const baseConfig = ConfigSchema.parse({
  curatedSources: [
    {
      listingUrl: "https://example.com/feed",
      strategies: ["rss"],
    },
  ],
  providers: {
    fetch: {
      providers: [
        {
          type: "jina",
          baseUrl: "https://fetch.example",
          authentication: { type: "bearer" },
          rateLimit: { requests: 1, perSeconds: 1 },
          concurrency: 4,
        },
      ],
    },
  },
  runPolicy: {
    minSuccessfulSources: 1,
    failOnZeroSuccess: true,
  },
});

const mockFetchSuccess = (
  data: Omit<FetchedWebSearchResult, "provider"> &
    Partial<Pick<FetchedWebSearchResult, "provider">>,
): WebFetchOutcome => ({
  success: { provider: "jina", ...data },
  failures: [],
});

const mockFetchFailure = (
  failure: Omit<WebFetchFailure, "provider"> &
    Partial<Pick<WebFetchFailure, "provider">>,
): WebFetchOutcome => ({
  success: null,
  failures: [{ provider: "jina", ...failure }],
});

vi.mock("@mediapulse/env/agents-page-collection", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
    AGENT_REGISTRY_URL: "http://agent-registry",
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

const dataCollectionCreateMock = vi.fn();
const existingUrlsCreateMock = vi.fn();
const deadUrlsLookupMock = vi.fn();
const deadUrlsRecordMock = vi.fn();
const runCreateMock = vi.fn();
const failureCreateMock = vi.fn();
const tickerGetMock = vi.fn();
const curatedListingQueryCreateMock = vi.fn();
const listingDiscoveryCacheLookupMock = vi.fn();
const listingDiscoveryCacheRecordMock = vi.fn();
const discoverySourceHealthRecordMock = vi.fn();

vi.mock("@workspace/agent-data-api-client", () => ({
  createAgentDataApiClient: vi.fn(() => ({
    dataCollection: {
      create: dataCollectionCreateMock,
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
    ticker: {
      get: tickerGetMock,
    },
    dataCollectionCuratedListingQuery: {
      create: curatedListingQueryCreateMock,
    },
    listingDiscoveryCacheLookup: {
      create: listingDiscoveryCacheLookupMock,
    },
    listingDiscoveryCacheRecord: {
      create: listingDiscoveryCacheRecordMock,
    },
    discoverySourceHealthRecord: {
      create: discoverySourceHealthRecordMock,
    },
  })),
}));

vi.mock("@workspace/agent-ingestion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/agent-ingestion")>();
  return {
    ...actual,
    runDiscovery: vi.fn(),
    performWebFetch: vi.fn(),
  };
});

import { runDiscovery, performWebFetch } from "@workspace/agent-ingestion";
import { runPageCollection } from "./run";

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

describe("runPageCollection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    tickerGetMock.mockResolvedValue({
      id: TICKER_ID,
      symbol: "BBCA",
      name: "Bank Central Asia",
      aliases: ["BCA"],
      sector: "Keuangan",
      industry: "Perbankan",
    });

    curatedListingQueryCreateMock.mockResolvedValue({
      searchQueryId: CURATED_QUERY_ID,
    });

    vi.mocked(runDiscovery).mockResolvedValue({
      items: [
        {
          url: "https://example.com/article-1",
          title: validArticleTitle,
          publishedAt: "2026-06-08T00:00:00.000Z",
        },
      ],
      failures: [],
      sourceReports: [
        {
          listingUrl: "https://example.com/feed",
          discovered: true,
          itemCount: 1,
          winningStrategy: "rss",
          failureCount: 0,
          lastError: null,
        },
      ],
    });

    vi.mocked(performWebFetch).mockResolvedValue([
      mockFetchSuccess({
        url: "https://example.com/article-1",
        title: validArticleTitle,
        content: validArticleContent,
        tickerId: TICKER_ID,
        searchQueryId: CURATED_QUERY_ID,
        searchQueryText: "",
        serpIndex: 0,
      }),
    ]);

    dataCollectionCreateMock.mockResolvedValue("{}");
    existingUrlsCreateMock.mockResolvedValue({
      existingUrls: [],
      hostCounts: {},
    });
    deadUrlsLookupMock.mockResolvedValue({ deadUrls: [] });
    deadUrlsRecordMock.mockResolvedValue({
      message: "Dead URLs recorded",
      recordedCount: 0,
    });
    runCreateMock.mockResolvedValue({});
    failureCreateMock.mockResolvedValue({});
    listingDiscoveryCacheLookupMock.mockResolvedValue({ entries: [] });
    listingDiscoveryCacheRecordMock.mockResolvedValue({});
    discoverySourceHealthRecordMock.mockResolvedValue({ recorded: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists gate-surviving sources attributed to the curated searchQueryId", async () => {
    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(dataCollectionCreateMock).toHaveBeenCalledOnce();

    const persistedSource = dataCollectionCreateMock.mock.calls[0]![0][0];

    expect(persistedSource.tickerId).toBe(TICKER_ID);
    expect(persistedSource.searchQueryId).toBe(CURATED_QUERY_ID);
    expect(persistedSource.url).toBe("https://example.com/article-1");
    expect(persistedSource.title).toBe(validArticleTitle);
  });

  it("records a DataCollectionRun with the correct tickerId and runId", async () => {
    await runPageCollection(createContext());

    expect(runCreateMock).toHaveBeenCalledOnce();

    const runPayload = runCreateMock.mock.calls[0]![0];

    expect(runPayload.tickerId).toBe(TICKER_ID);
    expect(typeof runPayload.id).toBe("string");
    expect(runPayload.status).toBe("success");
  });

  it("returns a summary with totalSources count", async () => {
    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(
      (result.details?.summary as { totalSources: number }).totalSources,
    ).toBe(1);
  });

  it("records discovery failure in counters but does not abort the run", async () => {
    vi.mocked(runDiscovery).mockResolvedValue({
      items: [
        {
          url: "https://example.com/article-1",
          title: validArticleTitle,
          publishedAt: "2026-06-08T00:00:00.000Z",
        },
      ],
      failures: [
        {
          sourceUrl: "https://example.com/bad-feed",
          strategyType: "rss",
          errorCategory: "network_error",
          message: "Connection refused",
          retryable: true,
        },
      ],
      sourceReports: [],
    });

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(true);
    expect(dataCollectionCreateMock).toHaveBeenCalledOnce();

    const runPayload = runCreateMock.mock.calls[0]![0];

    expect(runPayload.counters.searchFailed).toBe(1);
  });

  it("drops items that fail the pre-filter alias check before fetching", async () => {
    vi.mocked(runDiscovery).mockResolvedValue({
      items: [
        { url: "https://example.com/off-topic", title: "Sports news today" },
      ],
      failures: [],
      sourceReports: [],
    });

    const result = await runPageCollection(createContext());

    expect(vi.mocked(performWebFetch)).not.toHaveBeenCalled();
    expect(dataCollectionCreateMock).not.toHaveBeenCalled();

    expect(result.success).toBe(false);
  });

  it("passes through title-less items without pre-filtering them", async () => {
    vi.mocked(runDiscovery).mockResolvedValue({
      items: [{ url: "https://example.com/no-title" }],
      failures: [],
      sourceReports: [],
    });

    vi.mocked(performWebFetch).mockResolvedValue([
      mockFetchSuccess({
        url: "https://example.com/no-title",
        title: validArticleTitle,
        content: validArticleContent,
        tickerId: TICKER_ID,
        searchQueryId: CURATED_QUERY_ID,
        searchQueryText: "",
        serpIndex: 0,
      }),
    ]);

    const result = await runPageCollection(createContext());

    expect(vi.mocked(performWebFetch)).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it("skips already-existing URLs and does not fetch them", async () => {
    existingUrlsCreateMock.mockResolvedValue({
      existingUrls: ["https://example.com/article-1"],
      hostCounts: {},
    });

    const result = await runPageCollection(createContext());

    expect(vi.mocked(performWebFetch)).not.toHaveBeenCalled();
    expect(dataCollectionCreateMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it("records fetch failures in the failures payload and persists them", async () => {
    vi.mocked(performWebFetch).mockResolvedValue([
      mockFetchFailure({
        url: "https://example.com/article-1",
        queryId: CURATED_QUERY_ID,
        tickerId: TICKER_ID,
        errorCategory: "network_error",
        message: "ECONNREFUSED",
        retryable: true,
      }),
    ]);

    const result = await runPageCollection(createContext());

    expect(failureCreateMock).toHaveBeenCalledOnce();

    const failurePayload = failureCreateMock.mock.calls[0]![0][0];

    expect(failurePayload.stage).toBe("web-fetch");
    expect(failurePayload.tickerId).toBe(TICKER_ID);
    expect(result.success).toBe(false);
  });

  it("returns semantic failure when run policy is not met", async () => {
    vi.mocked(runDiscovery).mockResolvedValue({
      items: [],
      failures: [],
      sourceReports: [],
    });

    const result = await runPageCollection(createContext());

    expect(result.success).toBe(false);
    expect(typeof result.message).toBe("string");
    expect((result.details as { failureReason: string }).failureReason).toBe(
      "insufficient_successful_sources",
    );
  });

  it("truncates discovered items at maxDiscoveredItemsPerRun and logs the dropped count", async () => {
    const manyItems = Array.from({ length: 10 }, (_, index) => ({
      url: `https://example.com/article-${index}`,
      title: validArticleTitle,
    }));
    vi.mocked(runDiscovery).mockResolvedValue({
      items: manyItems,
      failures: [],
      sourceReports: [],
    });
    vi.mocked(performWebFetch).mockResolvedValue([
      mockFetchSuccess({
        url: "https://example.com/article-0",
        title: validArticleTitle,
        content: validArticleContent,
        tickerId: TICKER_ID,
        searchQueryId: CURATED_QUERY_ID,
        searchQueryText: "",
        serpIndex: 0,
      }),
    ]);

    const ctx = createContext({
      config: ConfigSchema.parse({
        ...baseConfig,
        collection: { maxDiscoveredItemsPerRun: 1, perRunFetchBudget: 50 },
        runPolicy: { minSuccessfulSources: 0, failOnZeroSuccess: false },
      }),
    });

    await runPageCollection(ctx);

    const warnCalls = (mockRunLog.warn as ReturnType<typeof vi.fn>).mock.calls;
    const capWarn = warnCalls.find(
      (args: unknown[]) =>
        typeof args[1] === "string" && args[1].includes("per-run cap"),
    );

    expect(capWarn).toBeDefined();
    expect(
      (capWarn![0] as { droppedByRunItemCap: number }).droppedByRunItemCap,
    ).toBe(9);
  });

  it("stops fetching and returns partial_success when the run deadline is exceeded", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);

    vi.mocked(runDiscovery).mockImplementation(async () => {
      vi.setSystemTime(1_100_000);

      return {
        items: [
          {
            url: "https://example.com/article-1",
            title: validArticleTitle,
          },
        ],
        failures: [],
        sourceReports: [],
      };
    });

    const ctx = createContext({
      config: ConfigSchema.parse({
        ...baseConfig,
        run: { maxDurationMs: 1 },
        runPolicy: { minSuccessfulSources: 0, failOnZeroSuccess: false },
      }),
    });

    let result;
    try {
      result = await runPageCollection(ctx);
    } finally {
      vi.useRealTimers();
    }

    expect(vi.mocked(performWebFetch)).not.toHaveBeenCalled();
    expect(result!.success).toBe(true);
    expect(
      (result!.details?.summary as { deadlineHit: boolean }).deadlineHit,
    ).toBe(true);

    const runRecord = runCreateMock.mock.calls[0]![0];

    expect(runRecord.status).toBe("partial_success");
  });

  it("strips tracking params from discovered URLs before dedup via classifyNoisyUrl", async () => {
    vi.mocked(runDiscovery).mockResolvedValue({
      items: [
        {
          url: "https://example.com/article-1?utm_source=feed&utm_medium=rss",
          title: validArticleTitle,
        },
        {
          url: "https://example.com/article-1?utm_source=newsletter",
          title: validArticleTitle,
        },
      ],
      failures: [],
      sourceReports: [],
    });

    vi.mocked(performWebFetch).mockResolvedValue([
      mockFetchSuccess({
        url: "https://example.com/article-1",
        title: validArticleTitle,
        content: validArticleContent,
        tickerId: TICKER_ID,
        searchQueryId: CURATED_QUERY_ID,
        searchQueryText: "",
        serpIndex: 0,
      }),
    ]);

    const ctx = createContext({
      config: ConfigSchema.parse({
        ...baseConfig,
        runPolicy: { minSuccessfulSources: 0, failOnZeroSuccess: false },
      }),
    });

    await runPageCollection(ctx);

    const fetchInputs = vi.mocked(performWebFetch).mock.calls[0]![0];

    expect(fetchInputs).toHaveLength(1);
    expect(fetchInputs[0]!.url).toBe("https://example.com/article-1");
  });

  it("posts per-source discovery health records to the health endpoint after the run", async () => {
    vi.mocked(runDiscovery).mockResolvedValue({
      items: [
        {
          url: "https://example.com/article-1",
          title: validArticleTitle,
          publishedAt: "2026-06-08T00:00:00.000Z",
        },
      ],
      failures: [],
      sourceReports: [
        {
          listingUrl: "https://example.com/feed",
          discovered: true,
          itemCount: 1,
          winningStrategy: "rss",
          failureCount: 0,
          lastError: null,
        },
      ],
    });

    await runPageCollection(createContext());

    expect(discoverySourceHealthRecordMock).toHaveBeenCalledOnce();
    const healthRecords = discoverySourceHealthRecordMock.mock.calls[0]![0];

    expect(healthRecords).toHaveLength(1);
    expect(healthRecords[0]).toMatchObject({
      listingUrl: "https://example.com/feed",
      discovered: true,
      itemCount: 1,
      winningStrategy: "rss",
      failureCount: 0,
      lastError: null,
    });
    expect(typeof healthRecords[0].runDate).toBe("string");
  });

  it("does not post health records when sourceReports is empty", async () => {
    vi.mocked(runDiscovery).mockResolvedValue({
      items: [],
      failures: [],
      sourceReports: [],
    });

    await runPageCollection(createContext());

    expect(discoverySourceHealthRecordMock).not.toHaveBeenCalled();
  });

  it("includes metadata.provider on each persisted source", async () => {
    await runPageCollection(createContext());

    expect(dataCollectionCreateMock).toHaveBeenCalledOnce();

    const persistedSource = dataCollectionCreateMock.mock.calls[0]![0][0];

    expect(persistedSource.metadata).toBeDefined();
    expect(persistedSource.metadata.provider).toBe("jina");
  });

  it("includes widened extended counters in the DataCollectionRun payload", async () => {
    await runPageCollection(createContext());

    expect(runCreateMock).toHaveBeenCalledOnce();

    const runPayload = runCreateMock.mock.calls[0]![0];

    expect(typeof runPayload.counters.discovered).toBe("number");
    expect(typeof runPayload.counters.afterPrefilter).toBe("number");
    expect(typeof runPayload.counters.persisted).toBe("number");
    expect(runPayload.counters.persisted).toBe(1);
  });
});
