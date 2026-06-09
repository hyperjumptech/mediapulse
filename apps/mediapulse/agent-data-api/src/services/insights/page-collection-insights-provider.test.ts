/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";

import { createPageCollectionInsightsProvider } from "./page-collection-insights-provider.js";

const NOW = new Date("2026-06-08T12:00:00.000Z");

function makeRun(overrides?: {
  tickerId?: string;
  startedAt?: Date;
  status?: string;
  fetchSuccess?: number;
  extendedCounters?: object | null;
}) {
  return {
    tickerId: overrides?.tickerId ?? "ticker-1",
    startedAt: overrides?.startedAt ?? new Date("2026-06-07T08:00:00.000Z"),
    status: overrides?.status ?? "success",
    fetchSuccess: overrides?.fetchSuccess ?? 5,
    extendedCounters: overrides?.extendedCounters ?? null,
  };
}

function makeSourceHealth(overrides?: {
  listingUrl?: string;
  runDate?: Date;
  discovered?: boolean;
  itemCount?: number;
  winningStrategy?: string | null;
  failureCount?: number;
}) {
  return {
    listingUrl: overrides?.listingUrl ?? "https://example.com/feed",
    runDate: overrides?.runDate ?? new Date("2026-06-07T00:00:00.000Z"),
    discovered: overrides?.discovered ?? true,
    itemCount: overrides?.itemCount ?? 10,
    winningStrategy: overrides?.winningStrategy ?? "rss",
    failureCount: overrides?.failureCount ?? 0,
  };
}

function makeDataSource(overrides?: {
  tickerId?: string;
  url?: string;
  createdAt?: Date;
  metadata?: object | null;
  ticker?: { symbol: string };
}) {
  return {
    tickerId: overrides?.tickerId ?? "ticker-1",
    url: overrides?.url ?? "https://publisher.com/article-1",
    createdAt: overrides?.createdAt ?? new Date(),
    metadata: overrides?.metadata ?? { provider: "jina" },
    ticker: overrides?.ticker ?? { symbol: "AAPL" },
  };
}

function makeDeps(overrides?: {
  runs?: ReturnType<typeof makeRun>[];
  sourceHealth?: ReturnType<typeof makeSourceHealth>[];
  dataSources?: ReturnType<typeof makeDataSource>[];
}) {
  const runs = overrides?.runs ?? [makeRun()];
  const sourceHealth = overrides?.sourceHealth ?? [makeSourceHealth()];
  const dataSources = overrides?.dataSources ?? [makeDataSource()];

  return {
    dataCollectionRun: {
      findMany: async () => runs,
    },
    discoverySourceHealth: {
      findMany: async () => sourceHealth,
    },
    dataSource: {
      findMany: async () => dataSources,
    },
  };
}

describe("createPageCollectionInsightsProvider", () => {
  it("returns a payload that parses through insightsPayloadSchema", async () => {
    const provider = createPageCollectionInsightsProvider(makeDeps());
    const payload = await provider.compute({ window: "7d" });

    const parsed = insightsPayloadSchema.parse(payload);

    expect(parsed.agentId).toBe("page-collection");
    expect(parsed.window).toBe("7d");
    expect(typeof parsed.generatedAt).toBe("string");
    expect(Array.isArray(parsed.kpis)).toBe(true);
    expect(Array.isArray(parsed.alerts)).toBe(true);
    expect(Array.isArray(parsed.sections)).toBe(true);
  });

  it("includes a funnel section with correct stage ordering", async () => {
    const provider = createPageCollectionInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            extendedCounters: {
              discovered: 100,
              afterPrefilter: 80,
              persisted: 20,
            },
            fetchSuccess: 30,
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const funnel = payload.sections.find((s) => s.id === "what-funnel");

    expect(funnel).toBeDefined();
    expect(funnel!.widget.kind).toBe("funnel");
    if (funnel!.widget.kind === "funnel") {
      expect(funnel!.widget.stages[0]!.label).toBe("Discovered");
      expect(funnel!.widget.stages[0]!.value).toBe(100);
      expect(funnel!.widget.stages[3]!.label).toBe("Persisted");
      expect(funnel!.widget.stages[3]!.value).toBe(20);
    }
  });

  it("aggregates extended counter drop reasons into the why-drops breakdown", async () => {
    const provider = createPageCollectionInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            extendedCounters: {
              droppedByRelevance: 10,
              droppedByFreshness: 5,
              droppedByContentQuality: { too_short: 3 },
            },
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const drops = payload.sections.find((s) => s.id === "why-drops");

    expect(drops).toBeDefined();
    expect(drops!.widget.kind).toBe("breakdown");
    if (drops!.widget.kind === "breakdown") {
      const relevance = drops!.widget.slices.find(
        (s) => s.label === "Relevance",
      );
      expect(relevance?.value).toBe(10);
      const freshness = drops!.widget.slices.find(
        (s) => s.label === "Freshness",
      );
      expect(freshness?.value).toBe(5);
      const fractions = drops!.widget.slices.map((s) => s.fraction);
      const fractionSum = fractions.reduce((sum, f) => sum + f, 0);
      expect(fractionSum).toBeCloseTo(1);
    }
  });

  it("caps per-ticker bars at TOP_N + Other bucket", async () => {
    const manyTickers = Array.from({ length: 15 }, (_, i) =>
      makeDataSource({
        tickerId: `ticker-${i}`,
        url: `https://pub${i}.com/a`,
        ticker: { symbol: `TICK${i}` },
      }),
    );

    const provider = createPageCollectionInsightsProvider(
      makeDeps({ dataSources: manyTickers }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tickerBar = payload.sections.find((s) => s.id === "who-per-ticker");

    expect(tickerBar).toBeDefined();
    if (tickerBar!.widget.kind === "categoryBar") {
      expect(tickerBar!.widget.bars.length).toBeLessThanOrEqual(11);
      const other = tickerBar!.widget.bars.find((b) => b.label === "Other");
      expect(other).toBeDefined();
    }
  });

  it("emits a strategy mix breakdown from DiscoverySourceHealth", async () => {
    const provider = createPageCollectionInsightsProvider(
      makeDeps({
        sourceHealth: [
          makeSourceHealth({ winningStrategy: "rss" }),
          makeSourceHealth({ winningStrategy: "rss" }),
          makeSourceHealth({ winningStrategy: "sitemap" }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const strategySection = payload.sections.find(
      (s) => s.id === "how-strategy-mix",
    );

    expect(strategySection).toBeDefined();
    if (strategySection!.widget.kind === "breakdown") {
      const rss = strategySection!.widget.slices.find((s) => s.label === "rss");
      expect(rss?.value).toBe(2);
      expect(rss?.fraction).toBeCloseTo(2 / 3);
    }
  });

  it("emits a provider mix breakdown from DataSource metadata", async () => {
    const provider = createPageCollectionInsightsProvider(
      makeDeps({
        dataSources: [
          makeDataSource({ metadata: { provider: "jina" } }),
          makeDataSource({ metadata: { provider: "jina" } }),
          makeDataSource({ metadata: { provider: "firecrawl" } }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const providerSection = payload.sections.find(
      (s) => s.id === "how-provider-mix",
    );

    expect(providerSection).toBeDefined();
    if (providerSection!.widget.kind === "breakdown") {
      const jina = providerSection!.widget.slices.find(
        (s) => s.label === "jina",
      );
      expect(jina?.value).toBe(2);
    }
  });

  it("computes KPI deltas from the prior period", async () => {
    const recentRun = makeRun({
      startedAt: new Date("2026-06-07T08:00:00.000Z"),
      fetchSuccess: 10,
    });

    const provider = createPageCollectionInsightsProvider(
      makeDeps({ runs: [recentRun] }),
    );

    const payload = await provider.compute({ window: "7d" });
    const articleKpi = payload.kpis.find((k) => k.id === "articles_collected");

    expect(articleKpi).toBeDefined();
    expect(articleKpi!.value).toBe(10);
    expect(typeof articleKpi!.delta).toBe("number");
  });

  it("emits a consecutive-failure alert when a source fails 3+ days", async () => {
    const failedSource = "https://bad-feed.example.com/rss";
    const provider = createPageCollectionInsightsProvider(
      makeDeps({
        sourceHealth: [
          makeSourceHealth({
            listingUrl: failedSource,
            discovered: false,
            failureCount: 1,
          }),
          makeSourceHealth({
            listingUrl: failedSource,
            discovered: false,
            failureCount: 1,
          }),
          makeSourceHealth({
            listingUrl: failedSource,
            discovered: false,
            failureCount: 1,
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const failAlert = payload.alerts.find((a) =>
      a.id.startsWith("consecutive-fail-"),
    );

    expect(failAlert).toBeDefined();
    expect(failAlert!.severity).toBe("warning");
  });

  it("returns a valid payload when all inputs are empty", async () => {
    const provider = createPageCollectionInsightsProvider(
      makeDeps({ runs: [], sourceHealth: [], dataSources: [] }),
    );

    const payload = await provider.compute({ window: "7d" });
    const parsed = insightsPayloadSchema.parse(payload);

    expect(parsed.kpis).toHaveLength(4);
    expect(parsed.alerts).toHaveLength(0);
  });
});
