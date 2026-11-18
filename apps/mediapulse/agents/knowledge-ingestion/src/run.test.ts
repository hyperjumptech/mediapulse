/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/agents-knowledge-ingestion", () => ({
  env: { AGENT_DATA_API_URL: "http://localhost:8081" },
}));

vi.mock("@workspace/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/logger")>();

  return {
    ...actual,
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  };
});

import type { OrganonIngestionCandidate } from "@workspace/agent-data-api-contract";
import type { FetchSourceBodiesResult } from "@workspace/agent-ingestion";

import { ConfigSchema } from "./config-schema.js";
import { createRunHandler, type RunDependencies } from "./run.js";

const NOW = new Date("2026-11-17T03:00:00.000Z");
const PUBLISHER_IRI = "https://mediapulse.hyperjump.tech/id/publisher-kontan";
const MAPB = {
  id: "ticker-mapb",
  symbol: "MAPB",
  name: "PT Map Boga Adiperkasa Tbk",
};
const MAPI = {
  id: "ticker-mapi",
  symbol: "MAPI",
  name: "PT Mitra Adiperkasa Tbk",
};

const candidate = (
  overrides: Partial<OrganonIngestionCandidate> = {},
): OrganonIngestionCandidate => ({
  canonicalUrl: "https://www.kontan.co.id/news/map-boga",
  url: "https://www.kontan.co.id/news/map-boga?utm_source=google",
  title: "Map Boga Adiperkasa buka gerai baru",
  description: "MAPB membuka gerai baru.",
  content: "Isi artikel.",
  dataSourceId: "ds-1",
  dataSourceIds: ["ds-1"],
  publishedAt: "2026-11-14T01:30:00.000Z",
  registrableDomain: "kontan.co.id",
  sectionScore: 0.8,
  tickers: [MAPB],
  sentTickerSymbols: [],
  ...overrides,
});

const emptyFetchResult = (): FetchSourceBodiesResult => ({
  fetchedContentById: new Map(),
  droppedByGateIds: new Set(),
  counters: {
    requested: 0,
    droppedByCap: 0,
    droppedByDeadUrlCache: 0,
    attempted: 0,
    retried: 0,
    fetchSucceeded: 0,
    fetchFailed: 0,
    gateDropped: 0,
    persisted: 0,
  },
  fetchEvents: [],
});

const setup = ({
  candidates,
  fetchResult = emptyFetchResult(),
  publisherIri = PUBLISHER_IRI as string | null,
  failedJobs = [] as string[],
  claimedJobIds = [] as string[],
}: {
  candidates: OrganonIngestionCandidate[];
  fetchResult?: FetchSourceBodiesResult;
  publisherIri?: string | null;
  failedJobs?: string[];
  claimedJobIds?: string[];
}) => {
  const dataApi = {
    organonIngestionCandidates: {
      get: vi.fn().mockResolvedValue({ candidates }),
    },
    organonIngestionSends: {
      create: vi.fn().mockResolvedValue({ recordedCount: 1 }),
      get: vi.fn().mockResolvedValue({ sends: [] }),
    },
    organonIngestionRetries: {
      create: vi.fn().mockResolvedValue({ claimedJobIds }),
    },
    contentGenerationFetchedContent: {
      create: vi.fn().mockResolvedValue({ updatedCount: 1 }),
    },
    contentGenerationFetchEvents: {
      create: vi.fn().mockResolvedValue({ recordedCount: 1 }),
    },
    dataCollectionDeadUrlsLookup: {
      create: vi.fn().mockResolvedValue({ deadUrls: [] }),
    },
    dataCollectionDeadUrlsRecord: { create: vi.fn().mockResolvedValue({}) },
  };
  let jobNumber = 0;
  const organon = {
    findPublisherIri: vi.fn().mockResolvedValue(publisherIri),
    createPublisher: vi.fn().mockResolvedValue(PUBLISHER_IRI),
    startIngestion: vi.fn().mockImplementation(async () => {
      jobNumber += 1;

      return { jobId: `job-${jobNumber}` };
    }),
    listFailedJobs: vi.fn().mockResolvedValue({
      jobs: failedJobs.map((id) => ({
        id,
        error: "Provider timed out",
        canonicalUrl: null,
        finishedAt: null,
      })),
      nextCursor: null,
    }),
    retryJob: vi.fn().mockResolvedValue("retried"),
    getJobStatus: vi.fn().mockResolvedValue("completed"),
    articleEvidence: vi.fn().mockResolvedValue({
      points: [],
      figuresWithoutPoint: [],
    }),
  };
  const fetchBodies = vi.fn().mockResolvedValue(fetchResult);
  const createIngestionClient = vi.fn().mockReturnValue(organon);
  const deps: RunDependencies = {
    createDataApi: (() =>
      dataApi) as unknown as RunDependencies["createDataApi"],
    createIngestionClient:
      createIngestionClient as unknown as RunDependencies["createIngestionClient"],
    fetchBodies: fetchBodies as unknown as RunDependencies["fetchBodies"],
    now: () => NOW,
  };

  return { dataApi, organon, fetchBodies, createIngestionClient, deps };
};

const config = (overrides: Record<string, unknown> = {}) =>
  ConfigSchema.parse({
    organonUrl: "https://organon.example",
    organonApiKey: "ingestion_key",
    sendFrom: "2026-11-10T00:00:00.000Z",
    ...overrides,
  });

const runWith = (
  deps: RunDependencies,
  overrides: Record<string, unknown> = {},
  input: { limit?: number } = {},
) =>
  createRunHandler(deps)({
    input,
    config: config(overrides),
    token: "Bearer invocation",
  });

describe("knowledge-ingestion run", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends each article as one job for every ticker it is placed for, and records the send", async () => {
    const { deps, dataApi, organon } = setup({
      candidates: [candidate({ tickers: [MAPB, MAPI] })],
    });

    const result = await runWith(deps);

    expect(result).toMatchObject({
      success: true,
      message: "Sent 1 of 1 articles to the knowledge graph",
      details: { candidates: 1, sent: 1, failed: 0 },
    });
    const request = organon.startIngestion.mock.calls[0]?.[0];
    expect(request.content).toContain(
      "- Placed for: MAPB (PT Map Boga Adiperkasa Tbk), MAPI (PT Mitra Adiperkasa Tbk)",
    );
    expect(request.metadata).toContainEqual({
      predicate: "http://purl.org/dc/terms/publisher",
      iri: PUBLISHER_IRI,
    });
    expect(dataApi.organonIngestionSends.create).toHaveBeenCalledWith([
      {
        canonicalUrl: "https://www.kontan.co.id/news/map-boga",
        tickerSymbols: ["MAPB", "MAPI"],
        organonJobId: "job-1",
        sentAt: NOW.toISOString(),
      },
    ]);
  });

  it("asks for candidates since the cutover, in UTC, no more than the run allows", async () => {
    const { deps, dataApi } = setup({ candidates: [] });

    await runWith(
      deps,
      {
        sendFrom: "2026-11-10T07:00:00+07:00",
        maxSendsPerRun: 50,
        lookbackDays: 3,
      },
      { limit: 80 },
    );

    expect(dataApi.organonIngestionCandidates.get).toHaveBeenCalledWith({
      sendFrom: "2026-11-10T00:00:00.000Z",
      lookbackDays: 3,
      take: 50,
    });
  });

  it("fetches a missing body first and sends what came back", async () => {
    const fetchResult = emptyFetchResult();
    fetchResult.fetchedContentById.set("ds-2", {
      content: "Fetched body.",
      fetchProvider: "serper",
    });
    fetchResult.counters.attempted = 2;
    const { deps, organon, fetchBodies } = setup({
      candidates: [
        candidate({
          canonicalUrl: "https://www.bisnis.com/read/a",
          dataSourceId: "ds-2",
          content: null,
        }),
        candidate({
          canonicalUrl: "https://www.bisnis.com/read/b",
          dataSourceId: "ds-3",
          content: null,
        }),
      ],
      fetchResult,
    });

    const result = await runWith(deps);

    expect(fetchBodies).toHaveBeenCalledTimes(1);
    expect(organon.startIngestion).toHaveBeenCalledTimes(1);
    expect(organon.startIngestion.mock.calls[0]?.[0].content).toContain(
      "Fetched body.",
    );
    expect(result.details).toMatchObject({
      fetchAttempted: 2,
      fetched: 1,
      noBody: 1,
      sent: 1,
    });
  });

  it("never fetches or sends an article from an excluded host", async () => {
    const { deps, organon, fetchBodies } = setup({
      candidates: [
        candidate({
          url: "https://news.google.com/rss/articles/CBMiabc?oc=5",
          content: null,
        }),
      ],
    });

    const result = await runWith(deps);

    expect(fetchBodies).not.toHaveBeenCalled();
    expect(organon.startIngestion).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({ excludedHost: 1, noBody: 0 });
  });

  it("creates a missing publisher once and reuses it for the run", async () => {
    const { deps, organon } = setup({
      candidates: [
        candidate({ canonicalUrl: "https://www.kontan.co.id/news/a" }),
        candidate({ canonicalUrl: "https://www.kontan.co.id/news/b" }),
      ],
      publisherIri: null,
    });

    const result = await runWith(deps);

    expect(organon.findPublisherIri).toHaveBeenCalledTimes(1);
    expect(organon.createPublisher).toHaveBeenCalledWith({
      registrableDomain: "kontan.co.id",
      label: "kontan.co.id",
    });
    expect(organon.createPublisher).toHaveBeenCalledTimes(1);
    expect(result.details).toMatchObject({ sent: 2, publishersCreated: 1 });
  });

  it("sends without a publisher when its lookup fails", async () => {
    const { deps, organon } = setup({ candidates: [candidate()] });
    organon.findPublisherIri.mockRejectedValue(new Error("SPARQL timed out"));

    const result = await runWith(deps);

    expect(result.details).toMatchObject({ sent: 1, publisherFailures: 1 });
    const metadata = organon.startIngestion.mock.calls[0]?.[0].metadata;
    expect(
      metadata.some(
        (fact: { predicate: string }) =>
          fact.predicate === "http://purl.org/dc/terms/publisher",
      ),
    ).toBe(false);
  });

  it("reports a failed send and still sends the rest", async () => {
    const { deps, organon, dataApi } = setup({
      candidates: [
        candidate({ canonicalUrl: "https://www.kontan.co.id/news/a" }),
        candidate({ canonicalUrl: "https://www.kontan.co.id/news/b" }),
      ],
    });
    organon.startIngestion
      .mockRejectedValueOnce(
        new Error("Organon answered 422 to an ingestion job"),
      )
      .mockResolvedValueOnce({ jobId: "job-2" });

    const result = await runWith(deps, { concurrency: 1 });

    expect(result).toMatchObject({
      success: true,
      details: {
        sent: 1,
        failed: 1,
        failures: [
          {
            canonicalUrl: "https://www.kontan.co.id/news/a",
            message: "Organon answered 422 to an ingestion job",
          },
        ],
      },
    });
    expect(dataApi.organonIngestionSends.create).toHaveBeenCalledTimes(1);
  });

  it("fails the run when every send fails", async () => {
    const { deps, organon } = setup({ candidates: [candidate()] });
    organon.startIngestion.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const result = await runWith(deps);

    expect(result).toMatchObject({
      success: false,
      message: "Sent 0 of 1 articles to the knowledge graph: every send failed",
    });
  });

  it("retries the failed jobs it could claim, once each", async () => {
    const { deps, organon, dataApi } = setup({
      candidates: [],
      failedJobs: ["job-old-1", "job-old-2"],
      claimedJobIds: ["job-old-1"],
    });

    const result = await runWith(deps);

    expect(dataApi.organonIngestionRetries.create).toHaveBeenCalledWith({
      organonJobIds: ["job-old-1", "job-old-2"],
    });
    expect(organon.retryJob).toHaveBeenCalledTimes(1);
    expect(organon.retryJob).toHaveBeenCalledWith("job-old-1");
    expect(result.details).toMatchObject({
      sweep: { failedJobs: 2, claimed: 1, retried: 1, notRetryable: 0 },
    });
  });

  it("keeps the run going when the sweep fails", async () => {
    const { deps, organon } = setup({ candidates: [candidate()] });
    organon.listFailedJobs.mockRejectedValue(new Error("Organon answered 500"));

    const result = await runWith(deps);

    expect(result).toMatchObject({
      success: true,
      details: { sent: 1, sweep: { error: "Organon answered 500" } },
    });
  });

  it("only reports what it would send on a dry run", async () => {
    const { deps, createIngestionClient, fetchBodies, dataApi } = setup({
      candidates: [candidate({ sentTickerSymbols: ["MAPI"] })],
    });

    const result = await runWith(deps, { dryRun: true });

    expect(result).toEqual({
      success: true,
      message: "Dry run: 1 articles would be sent",
      details: {
        dryRun: true,
        candidates: [
          {
            canonicalUrl: "https://www.kontan.co.id/news/map-boga",
            tickers: ["MAPB"],
            sentTickerSymbols: ["MAPI"],
            hasBody: true,
          },
        ],
      },
    });
    expect(createIngestionClient).not.toHaveBeenCalled();
    expect(fetchBodies).not.toHaveBeenCalled();
    expect(dataApi.organonIngestionSends.create).not.toHaveBeenCalled();
  });

  it("checks what Organon added for the articles sent in the day before this run", async () => {
    const { deps, dataApi, organon } = setup({ candidates: [] });
    dataApi.organonIngestionSends.get.mockResolvedValue({
      sends: [
        {
          canonicalUrl: "https://www.kontan.co.id/news/map-boga",
          tickerSymbols: ["MAPB"],
          organonJobId: "job-earlier",
          sentAt: "2026-11-16T03:05:00.000Z",
          title: "Map Boga Adiperkasa buka gerai baru",
          description: null,
          content: "Isi artikel.",
        },
      ],
    });

    const result = await runWith(deps);

    expect(dataApi.organonIngestionSends.get).toHaveBeenCalledWith({
      sentAfter: "2026-11-16T03:00:00.000Z",
      sentBefore: NOW.toISOString(),
      take: 200,
    });
    expect(organon.getJobStatus).toHaveBeenCalledWith("job-earlier");
    expect(result).toMatchObject({
      success: true,
      details: {
        evidence: { sends: 1, checked: 1, withoutPoints: { count: 1 } },
      },
    });
  });

  it("skips the evidence check when it is turned off", async () => {
    const { deps, dataApi } = setup({ candidates: [] });

    const result = await runWith(deps, { evidenceCheck: { enabled: false } });

    expect(dataApi.organonIngestionSends.get).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({ evidence: null });
  });

  it("still succeeds when the evidence check itself fails", async () => {
    const { deps, dataApi } = setup({ candidates: [candidate()] });
    dataApi.organonIngestionSends.get.mockRejectedValue(
      new Error("agent-data-api unavailable"),
    );

    const result = await runWith(deps);

    expect(result).toMatchObject({
      success: true,
      details: { sent: 1, evidence: { error: "agent-data-api unavailable" } },
    });
  });
});
