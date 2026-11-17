import { describe, expect, it, vi } from "vitest";

import type { OrganonIngestionCandidate } from "@workspace/agent-data-api-contract";
import type {
  FetchSourceBodiesConfig,
  FetchSourceBodiesResult,
  RequestedFetchSource,
} from "@workspace/agent-ingestion";

import {
  FETCH_REASON,
  fetchMissingBodies,
  type BodyDataApi,
} from "./fetch-missing-bodies.js";

const CONFIG: FetchSourceBodiesConfig = {
  maxFetches: 10,
  providers: [],
  deadUrlCache: { enabled: true, skipLookupBatchSize: 50 },
  hostErrorBreaker: { enabled: true, minAttempts: 5, errorRateThreshold: 0.5 },
};

const candidate = (
  index: number,
  tickerId: string,
  content: string | null = null,
): OrganonIngestionCandidate => ({
  canonicalUrl: `https://www.kontan.co.id/news/map-boga-buka-gerai-${index}`,
  url: `https://www.kontan.co.id/news/map-boga-buka-gerai-${index}`,
  title: `Article ${index}`,
  description: null,
  content,
  dataSourceId: `ds-${index}`,
  dataSourceIds: [`ds-${index}`],
  publishedAt: null,
  registrableDomain: "kontan.co.id",
  sectionScore: 0.5,
  tickers: [{ id: tickerId, symbol: tickerId.toUpperCase(), name: tickerId }],
  sentTickerSymbols: [],
});

const createDataApi = () => ({
  contentGenerationFetchedContent: {
    create: vi.fn().mockImplementation(async (body: unknown[]) => ({
      updatedCount: body.length,
    })),
  },
  contentGenerationFetchEvents: {
    create: vi.fn().mockResolvedValue({ recordedCount: 1 }),
  },
  dataCollectionDeadUrlsLookup: {
    create: vi.fn().mockResolvedValue({ deadUrls: [] }),
  },
  dataCollectionDeadUrlsRecord: { create: vi.fn().mockResolvedValue({}) },
});

const fetchedFor = (
  requested: readonly RequestedFetchSource[],
  attempted = requested.length,
): FetchSourceBodiesResult => ({
  fetchedContentById: new Map(
    requested.map((source) => [
      source.dataSourceId,
      { content: `Body of ${source.dataSourceId}`, fetchProvider: "serper" },
    ]),
  ),
  droppedByGateIds: new Set(),
  counters: {
    requested: requested.length,
    droppedByCap: 0,
    droppedByDeadUrlCache: 0,
    attempted,
    retried: 0,
    fetchSucceeded: requested.length,
    fetchFailed: 0,
    gateDropped: 0,
    persisted: requested.length,
  },
  fetchEvents: requested.map((source) => ({
    dataSourceId: source.dataSourceId,
    reason: source.reason ?? "",
    provider: "serper",
    status: "succeeded" as const,
  })),
});

describe("fetchMissingBodies", () => {
  it("keeps stored bodies and fetches only the missing ones, once per first ticker", async () => {
    const dataApi = createDataApi();
    const fetchBodies = vi
      .fn()
      .mockImplementation(async (requested: RequestedFetchSource[]) =>
        fetchedFor(requested),
      );

    const result = await fetchMissingBodies({
      candidates: [
        candidate(1, "mapb", "Stored body."),
        candidate(2, "mapb"),
        candidate(3, "mapi"),
      ],
      config: CONFIG,
      dataApi: dataApi as unknown as BodyDataApi,
      fetchBodies: fetchBodies as never,
    });

    expect([...result.bodies.entries()]).toEqual([
      ["https://www.kontan.co.id/news/map-boga-buka-gerai-1", "Stored body."],
      ["https://www.kontan.co.id/news/map-boga-buka-gerai-2", "Body of ds-2"],
      ["https://www.kontan.co.id/news/map-boga-buka-gerai-3", "Body of ds-3"],
    ]);
    expect(result).toMatchObject({ fetchAttempted: 2, fetched: 2 });
    expect(fetchBodies).toHaveBeenCalledTimes(2);
    expect(fetchBodies.mock.calls[0]?.[0]).toEqual([
      {
        dataSourceId: "ds-2",
        url: "https://www.kontan.co.id/news/map-boga-buka-gerai-2",
        title: "Article 2",
        sectionScore: 0.5,
        reason: FETCH_REASON,
      },
    ]);
    expect(fetchBodies.mock.calls[0]?.[2]).toEqual({ tickerId: "mapb" });
    expect(dataApi.contentGenerationFetchEvents.create).toHaveBeenCalledWith([
      {
        dataSourceId: "ds-2",
        tickerId: "mapb",
        reason: FETCH_REASON,
        provider: "serper",
        status: "succeeded",
      },
    ]);
  });

  it("shares the fetch budget across tickers and stops once it is spent", async () => {
    const fetchBodies = vi
      .fn()
      .mockImplementation(async (requested: RequestedFetchSource[]) =>
        fetchedFor(requested, 3),
      );

    const result = await fetchMissingBodies({
      candidates: [
        candidate(1, "mapb"),
        candidate(2, "mapi"),
        candidate(3, "aces"),
      ],
      config: { ...CONFIG, maxFetches: 5 },
      dataApi: createDataApi() as unknown as BodyDataApi,
      fetchBodies: fetchBodies as never,
    });

    expect(fetchBodies).toHaveBeenCalledTimes(2);
    expect(fetchBodies.mock.calls[0]?.[1]).toMatchObject({ maxFetches: 5 });
    expect(fetchBodies.mock.calls[1]?.[1]).toMatchObject({ maxFetches: 2 });
    expect(result.fetchAttempted).toBe(6);
  });

  it("saves fetched bodies in batches agent-data-api accepts", async () => {
    const dataApi = createDataApi();
    const fetchBodies = vi.fn().mockImplementation(
      async (
        requested: RequestedFetchSource[],
        _config: unknown,
        _context: unknown,
        deps: {
          persistFetchedContent: (body: unknown[]) => Promise<unknown>;
        },
      ) => {
        await deps.persistFetchedContent(
          requested.map((source) => ({
            dataSourceId: source.dataSourceId,
            content: "Body",
            fetchProvider: "serper",
          })),
        );

        return fetchedFor(requested);
      },
    );

    await fetchMissingBodies({
      candidates: Array.from({ length: 120 }, (_, index) =>
        candidate(index, "mapb"),
      ),
      config: { ...CONFIG, maxFetches: 200 },
      dataApi: dataApi as unknown as BodyDataApi,
      fetchBodies: fetchBodies as never,
    });

    const batchSizes =
      dataApi.contentGenerationFetchedContent.create.mock.calls.map(
        (call) => (call[0] as unknown[]).length,
      );
    expect(batchSizes).toEqual([50, 50, 20]);
    expect(dataApi.contentGenerationFetchEvents.create).toHaveBeenCalledTimes(
      2,
    );
  });

  it("leaves out an article from an excluded host without fetching it", async () => {
    const fetchBodies = vi.fn();

    const result = await fetchMissingBodies({
      candidates: [
        {
          ...candidate(1, "mapb"),
          url: "https://news.google.com/rss/articles/CBMiabc?oc=5",
        },
      ],
      config: CONFIG,
      dataApi: createDataApi() as unknown as BodyDataApi,
      fetchBodies: fetchBodies as never,
    });

    expect(result.excludedUrls).toEqual([
      "https://www.kontan.co.id/news/map-boga-buka-gerai-1",
    ]);
    expect(fetchBodies).not.toHaveBeenCalled();
  });
});
