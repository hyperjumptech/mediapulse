/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type {
  WebFetchOutcome,
  WebSearchResult,
} from "@workspace/agent-ingestion";

import { ContentGenerationConfigSchema } from "./config-schema.js";
import {
  acceptablePublishedDate,
  MAX_BACKFILL_AGE_DAYS,
  fetchSourceBodies,
  type RequestedFetchSource,
} from "./fetch-source-bodies.js";

const makeConfig = (overrides?: Record<string, unknown>) =>
  ContentGenerationConfigSchema.parse({
    model: { apiKey: "sk-test", model: "gpt-4o" },
    ...overrides,
  });

const successOutcome = (
  url: string,
  content: string,
  provider = "serper",
): WebFetchOutcome => ({
  success: {
    url,
    title: "Title",
    content,
    tickerId: "",
    searchQueryId: "",
    searchQueryText: "",
    serpIndex: 0,
    provider: provider as never,
  },
  failures: [],
});

const failureOutcome = (url: string): WebFetchOutcome => ({
  success: null,
  failures: [
    {
      url,
      queryId: "",
      tickerId: "ticker-1",
      provider: "serper",
      errorCategory: "provider_http_error",
      message: "not found",
      retryable: false,
      httpStatus: 404,
    },
  ],
});

describe("fetchSourceBodies", () => {
  it("returns early with zero counters when nothing is requested", async () => {
    const persistFetchedContent = vi.fn();

    const result = await fetchSourceBodies(
      [],
      makeConfig(),
      { tickerId: "ticker-1" },
      { persistFetchedContent },
    );

    expect(result.counters.requested).toBe(0);
    expect(persistFetchedContent).not.toHaveBeenCalled();
  });

  it("caps requests at maxFetchesPerRun, keeping the highest sectionScore", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-low",
        url: "https://x/low",
        title: "Low",
        sectionScore: 0.5,
      },
      {
        dataSourceId: "ds-high",
        url: "https://x/high",
        title: "High",
        sectionScore: 0.9,
      },
      {
        dataSourceId: "ds-mid",
        url: "https://x/mid",
        title: "Mid",
        sectionScore: 0.7,
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockImplementation((inputs: WebSearchResult[]) =>
        Promise.resolve(
          inputs.map((input) => successOutcome(input.url, "body")),
        ),
      );
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 2 });

    const result = await fetchSourceBodies(
      requested,
      makeConfig({ maxFetchesPerRun: 2 }),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    const fetchedInputs = performWebFetchFn.mock
      .calls[0]![0] as WebSearchResult[];
    const fetchedUrls = fetchedInputs.map((input) => input.url);

    expect(result.counters.droppedByCap).toBe(1);
    expect(result.counters.attempted).toBe(2);
    expect(fetchedUrls).toEqual(["https://x/high", "https://x/mid"]);
    expect(result.fetchedContentById.has("ds-low")).toBe(false);
  });

  it("fetches a description citing a figure ahead of a better-scoring one that cites none", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-no-figure",
        url: "https://x/no-figure",
        title: "No figure",
        sectionScore: 0.9,
      },
      {
        dataSourceId: "ds-figure",
        url: "https://x/figure",
        title: "Figure",
        sectionScore: 0.4,
        citesFigure: true,
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockImplementation((inputs: WebSearchResult[]) =>
        Promise.resolve(
          inputs.map((input) => successOutcome(input.url, "body")),
        ),
      );

    await fetchSourceBodies(
      requested,
      makeConfig({ maxFetchesPerRun: 1 }),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent: vi.fn().mockResolvedValue({ updatedCount: 1 }),
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    const fetchedInputs = performWebFetchFn.mock
      .calls[0]![0] as WebSearchResult[];

    expect(fetchedInputs.map((input) => input.url)).toEqual([
      "https://x/figure",
    ]);
  });

  it("persists passing bodies and returns them keyed by data-source id", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-1",
        url: "https://x/1",
        title: "One",
        sectionScore: 0.9,
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([
        successOutcome("https://x/1", "Full body one", "tavily"),
      ]);
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 1 });

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    expect(persistFetchedContent).toHaveBeenCalledWith([
      {
        dataSourceId: "ds-1",
        content: "Full body one",
        fetchProvider: "tavily",
      },
    ]);
    expect(result.fetchedContentById.get("ds-1")).toEqual({
      content: "Full body one",
      fetchProvider: "tavily",
    });
    expect(result.counters.fetchSucceeded).toBe(1);
    expect(result.counters.persisted).toBe(1);
  });

  it("derives publishedAt from the fetched body when the row carries none", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-1",
        url: "https://kontan.co.id/undated",
        title: "One",
      },
    ];
    const body =
      '<meta property="article:published_time" content="2026-08-05T02:00:00Z" /> Alfamart siap gelontorkan';
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([
        successOutcome("https://kontan.co.id/undated", body, "tavily"),
      ]);
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 1 });

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    expect(persistFetchedContent).toHaveBeenCalledWith([
      {
        dataSourceId: "ds-1",
        content: body,
        fetchProvider: "tavily",
        publishedAt: "2026-08-05T02:00:00.000Z",
      },
    ]);
    expect(result.fetchedContentById.get("ds-1")?.publishedAt).toBe(
      "2026-08-05T02:00:00.000Z",
    );
  });

  it("persists the body but drops a future-dated publishedAt", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-1",
        url: "https://investor.id/kado-bi-mdr-qris-0",
        title: "Kado BI untuk HUT ke-81 RI, Luncurkan MDR QRIS 0%",
      },
    ];
    const body =
      '<meta property="article:published_time" content="2126-10-01T00:00:00Z" /> Kebijakan MDR QRIS 0% berlaku mulai 1 Oktober.';
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([
        successOutcome(
          "https://investor.id/kado-bi-mdr-qris-0",
          body,
          "serper",
        ),
      ]);
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 1 });

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    expect(persistFetchedContent).toHaveBeenCalledWith([
      {
        dataSourceId: "ds-1",
        content: body,
        fetchProvider: "serper",
      },
    ]);
    expect(result.fetchedContentById.get("ds-1")?.publishedAt).toBeUndefined();
    expect(result.fetchedContentById.get("ds-1")?.content).toBe(body);
  });

  it("omits publishedAt when the body carries no date signal", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-1",
        url: "https://kontan.co.id/undated",
        title: "One",
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([
        successOutcome(
          "https://kontan.co.id/undated",
          "No date anywhere",
          "tavily",
        ),
      ]);
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 1 });

    await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    expect(persistFetchedContent).toHaveBeenCalledWith([
      {
        dataSourceId: "ds-1",
        content: "No date anywhere",
        fetchProvider: "tavily",
      },
    ]);
  });

  it("drops a gate-failed body without persisting or citing it", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-junk",
        url: "https://x/junk",
        title: "Junk",
        sectionScore: 0.9,
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([
        successOutcome("https://x/junk", "429 too many requests"),
      ]);
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 0 });
    const recordDeadUrls = vi.fn().mockResolvedValue(undefined);

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        recordDeadUrls,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({
          blocked: true,
          reason: "content_too_short",
        }),
      },
    );

    expect(result.droppedByGateIds.has("ds-junk")).toBe(true);
    expect(result.fetchedContentById.has("ds-junk")).toBe(false);
    expect(persistFetchedContent).not.toHaveBeenCalled();
    expect(result.counters.gateDropped).toBe(1);
  });

  it("records a failed fetch and reports it in counters", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-dead",
        url: "https://x/dead",
        title: "Dead",
        sectionScore: 0.9,
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([failureOutcome("https://x/dead")]);
    const persistFetchedContent = vi.fn();
    const recordDeadUrls = vi.fn().mockResolvedValue(undefined);

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        recordDeadUrls,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    expect(result.counters.fetchFailed).toBe(1);
    expect(persistFetchedContent).not.toHaveBeenCalled();
    expect(recordDeadUrls).toHaveBeenCalledTimes(1);
  });

  it("emits a succeeded fetch event carrying the triage reason and provider", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-ok",
        url: "https://x/ok",
        title: "Ok",
        sectionScore: 0.9,
        reason: "description too thin",
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([successOutcome("https://x/ok", "Full body", "exa")]);
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 1 });

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    expect(result.fetchEvents).toEqual([
      {
        dataSourceId: "ds-ok",
        reason: "description too thin",
        provider: "exa",
        status: "succeeded",
      },
    ]);
  });

  it("emits a gate_dropped fetch event keeping the resolved provider", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-junk",
        url: "https://x/junk",
        title: "Junk",
        sectionScore: 0.9,
        reason: "bare headline",
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([
        successOutcome("https://x/junk", "429 too many requests", "tavily"),
      ]);
    const persistFetchedContent = vi.fn();
    const recordDeadUrls = vi.fn().mockResolvedValue(undefined);

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        recordDeadUrls,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({
          blocked: true,
          reason: "content_too_short",
        }),
      },
    );

    expect(result.fetchEvents).toEqual([
      {
        dataSourceId: "ds-junk",
        reason: "bare headline",
        provider: "tavily",
        status: "gate_dropped",
      },
    ]);
  });

  it("emits a fetch_failed event with a null provider when no body comes back", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-dead",
        url: "https://x/dead",
        title: "Dead",
        sectionScore: 0.9,
        reason: "cut off mid-thought",
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockResolvedValue([failureOutcome("https://x/dead")]);
    const persistFetchedContent = vi.fn();
    const recordDeadUrls = vi.fn().mockResolvedValue(undefined);

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        recordDeadUrls,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    expect(result.fetchEvents).toEqual([
      {
        dataSourceId: "ds-dead",
        reason: "cut off mid-thought",
        provider: null,
        status: "fetch_failed",
      },
    ]);
  });

  it("skips URLs cached as dead before fetching", async () => {
    const requested: RequestedFetchSource[] = [
      {
        dataSourceId: "ds-live",
        url: "https://x/live",
        title: "Live",
        sectionScore: 0.9,
      },
      {
        dataSourceId: "ds-dead",
        url: "https://x/dead",
        title: "Dead",
        sectionScore: 0.8,
      },
    ];
    const performWebFetchFn = vi
      .fn()
      .mockImplementation((inputs: WebSearchResult[]) =>
        Promise.resolve(
          inputs.map((input) => successOutcome(input.url, "body")),
        ),
      );
    const persistFetchedContent = vi
      .fn()
      .mockResolvedValue({ updatedCount: 1 });
    const lookupDeadUrls = vi
      .fn()
      .mockResolvedValue({ deadUrls: ["https://x/dead"] });

    const result = await fetchSourceBodies(
      requested,
      makeConfig(),
      { tickerId: "ticker-1" },
      {
        persistFetchedContent,
        lookupDeadUrls,
        performWebFetchFn: performWebFetchFn as never,
        runQualityGateFn: () => ({ blocked: false }),
      },
    );

    const fetchedInputs = performWebFetchFn.mock
      .calls[0]![0] as WebSearchResult[];

    expect(result.counters.droppedByDeadUrlCache).toBe(1);
    expect(fetchedInputs.map((input) => input.url)).toEqual(["https://x/live"]);
  });
});

describe("acceptablePublishedDate", () => {
  const now = new Date("2026-08-20T00:00:00Z");

  it("discards a date lifted from body text that lands in the future", () => {
    expect(
      acceptablePublishedDate(new Date("2026-10-01T00:00:00Z"), now),
    ).toBeUndefined();
  });

  it("keeps a date within the clock-skew tolerance", () => {
    const publishedAt = new Date("2026-08-20T18:00:00Z");

    expect(acceptablePublishedDate(publishedAt, now)).toBe(publishedAt);
  });

  it("keeps a moderately old date well inside the backfill age limit", () => {
    const publishedAt = new Date("2026-07-01T00:00:00Z");

    expect(acceptablePublishedDate(publishedAt, now)).toBe(publishedAt);
  });

  it("discards a date lifted from body text that predates any collectable article", () => {
    expect(
      acceptablePublishedDate(new Date("2025-01-01T00:00:00Z"), now),
    ).toBeUndefined();
  });

  it("keeps a date on the near side of the backfill age limit", () => {
    const publishedAt = new Date(
      now.getTime() - (MAX_BACKFILL_AGE_DAYS - 1) * 86_400_000,
    );

    expect(acceptablePublishedDate(publishedAt, now)).toBe(publishedAt);
  });

  it("discards a date past the backfill age limit", () => {
    const publishedAt = new Date(
      now.getTime() - (MAX_BACKFILL_AGE_DAYS + 1) * 86_400_000,
    );

    expect(acceptablePublishedDate(publishedAt, now)).toBeUndefined();
  });

  it("returns undefined when the page carried no extractable date", () => {
    expect(acceptablePublishedDate(null, now)).toBeUndefined();
  });
});
