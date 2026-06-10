/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";

import { createDataCollectionInsightsProvider } from "./data-collection-insights-provider.js";

function makeRun(overrides?: {
  id?: string;
  tickerId?: string;
  startedAt?: Date;
  status?: string;
  fetchSuccess?: number;
  searchSuccess?: number;
  searchFailed?: number;
  queriesTotal?: number;
  extendedCounters?: object | null;
}) {
  const defaultExtendedCounters = {
    agentId: "data-collection",
    persisted: 10,
    discovered: 20,
    afterPrefilter: 18,
    durationMs: 30000,
  };
  return {
    id: overrides?.id ?? "run-1",
    tickerId: overrides?.tickerId ?? "ticker-1",
    startedAt:
      overrides?.startedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: overrides?.status ?? "success",
    fetchSuccess: overrides?.fetchSuccess ?? 10,
    searchSuccess: overrides?.searchSuccess ?? 20,
    searchFailed: overrides?.searchFailed ?? 2,
    queriesTotal: overrides?.queriesTotal ?? 5,
    extendedCounters:
      overrides !== undefined &&
      Object.prototype.hasOwnProperty.call(overrides, "extendedCounters")
        ? overrides.extendedCounters
        : defaultExtendedCounters,
  };
}

function makeFailure(overrides?: {
  runId?: string;
  stage?: string;
  provider?: string;
  errorCategory?: string;
}) {
  return {
    runId: overrides?.runId ?? "run-1",
    stage: overrides?.stage ?? "fetch",
    provider: overrides?.provider ?? "jina",
    errorCategory: overrides?.errorCategory ?? "network",
  };
}

function makeDataSource(overrides?: {
  tickerId?: string;
  url?: string;
  createdAt?: Date;
  ticker?: { symbol: string };
}) {
  return {
    tickerId: overrides?.tickerId ?? "ticker-1",
    url: overrides?.url ?? "https://reuters.com/article-1",
    createdAt: overrides?.createdAt ?? new Date("2026-06-07T08:00:00.000Z"),
    ticker: overrides?.ticker ?? { symbol: "AAPL" },
  };
}

function makeDeps(
  runs: ReturnType<typeof makeRun>[],
  failures: ReturnType<typeof makeFailure>[],
  dataSources: ReturnType<typeof makeDataSource>[],
) {
  return {
    dataCollectionRun: {
      findMany: async () => runs,
    },
    dataCollectionFailure: {
      findMany: async () => failures,
    },
    dataSource: {
      findMany: async () => dataSources,
    },
  };
}

describe("createDataCollectionInsightsProvider", () => {
  it("produces a payload that passes insightsPayloadSchema", async () => {
    const provider = createDataCollectionInsightsProvider(
      makeDeps([makeRun()], [makeFailure()], [makeDataSource()]),
    );
    const payload = await provider.compute({ window: "7d" });
    const result = insightsPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("excludes page-collection runs from all counts", async () => {
    const dataCollectionRun = makeRun({
      id: "dc-run",
      fetchSuccess: 10,
      extendedCounters: { agentId: "data-collection", persisted: 10 },
    });
    const pageCollectionRun = makeRun({
      id: "pc-run",
      fetchSuccess: 999,
      extendedCounters: { agentId: "page-collection", persisted: 999 },
    });
    const deps = makeDeps([dataCollectionRun, pageCollectionRun], [], []);
    const provider = createDataCollectionInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });
    const articleKpi = payload.kpis.find((k) => k.id === "articles_collected");
    expect(articleKpi?.value).toBe(10);
  });

  it("excludes runs without agentId from data-collection counts", async () => {
    const runWithoutAgentId = makeRun({
      id: "old-run",
      fetchSuccess: 999,
      extendedCounters: null,
    });
    const deps = makeDeps([runWithoutAgentId], [], []);
    const provider = createDataCollectionInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });
    const articleKpi = payload.kpis.find((k) => k.id === "articles_collected");
    expect(articleKpi?.value).toBe(0);
  });

  it("computes funnel with fetched >= persisted", async () => {
    const run = makeRun({
      queriesTotal: 5,
      fetchSuccess: 8,
      extendedCounters: {
        agentId: "data-collection",
        discovered: 20,
        persisted: 6,
      },
    });
    const provider = createDataCollectionInsightsProvider(
      makeDeps([run], [], []),
    );
    const payload = await provider.compute({ window: "7d" });
    const funnel = payload.sections.find((s) => s.id === "what-funnel");
    expect(funnel?.widget.kind).toBe("funnel");
    if (funnel?.widget.kind !== "funnel") return;
    const fetched = funnel.widget.stages.find((s) => s.label === "Fetched");
    const persisted = funnel.widget.stages.find((s) => s.label === "Persisted");
    expect(fetched).toBeDefined();
    expect(persisted).toBeDefined();
    expect(fetched!.value).toBeGreaterThanOrEqual(persisted!.value);
  });

  it("aggregates drop reasons from extendedCounters", async () => {
    const run = makeRun({
      extendedCounters: {
        agentId: "data-collection",
        droppedByRelevance: 5,
        droppedByFreshness: 3,
        droppedByContentQuality: { low_quality: 2 },
        persisted: 10,
        discovered: 25,
      },
    });
    const provider = createDataCollectionInsightsProvider(
      makeDeps([run], [], []),
    );
    const payload = await provider.compute({ window: "7d" });
    const dropSection = payload.sections.find(
      (s) => s.id === "why-drop-reasons",
    );
    expect(dropSection).toBeDefined();
    if (dropSection?.widget.kind !== "breakdown") return;
    const labels = dropSection.widget.slices.map((s) => s.label);
    expect(labels).toContain("Relevance");
    expect(labels).toContain("Freshness");
    expect(labels).toContain("Content: low_quality");
  });

  it("drop reason fractions sum to 1", async () => {
    const run = makeRun({
      extendedCounters: {
        agentId: "data-collection",
        droppedByRelevance: 4,
        droppedByFreshness: 6,
        persisted: 10,
        discovered: 20,
      },
    });
    const provider = createDataCollectionInsightsProvider(
      makeDeps([run], [], []),
    );
    const payload = await provider.compute({ window: "7d" });
    const dropSection = payload.sections.find(
      (s) => s.id === "why-drop-reasons",
    );
    if (dropSection?.widget.kind !== "breakdown") return;
    const total = dropSection.widget.slices.reduce(
      (sum, s) => sum + s.fraction,
      0,
    );
    expect(total).toBeCloseTo(1, 5);
  });

  it("computes KPI delta between current and prior window", async () => {
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const windowStart = now - windowMs;
    const priorStart = windowStart - windowMs;
    const priorRun = makeRun({
      id: "prior-run",
      startedAt: new Date(priorStart + 1000),
      fetchSuccess: 5,
      extendedCounters: { agentId: "data-collection", persisted: 5 },
    });
    const currentRun = makeRun({
      id: "current-run",
      startedAt: new Date(windowStart + 1000),
      fetchSuccess: 15,
      extendedCounters: { agentId: "data-collection", persisted: 15 },
    });
    const provider = createDataCollectionInsightsProvider(
      makeDeps([priorRun, currentRun], [], []),
    );
    const payload = await provider.compute({ window: "7d" });
    const articleKpi = payload.kpis.find((k) => k.id === "articles_collected");
    expect(articleKpi?.value).toBe(15);
    expect(articleKpi?.delta).toBe(10);
  });

  it("emits low-search-success alert when rate is below 50%", async () => {
    const run = makeRun({
      searchSuccess: 2,
      searchFailed: 8,
      extendedCounters: { agentId: "data-collection", persisted: 2 },
    });
    const provider = createDataCollectionInsightsProvider(
      makeDeps([run], [], []),
    );
    const payload = await provider.compute({ window: "7d" });
    const alert = payload.alerts.find((a) => a.id === "low-search-success");
    expect(alert).toBeDefined();
  });

  it("emits stage-failure alert when a stage has more than 5 failures", async () => {
    const run = makeRun({ id: "run-x" });
    const failures = Array.from({ length: 6 }, (_, i) =>
      makeFailure({ runId: "run-x", stage: "fetch", provider: `p-${i}` }),
    );
    const deps = makeDeps([run], failures, []);
    const provider = createDataCollectionInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });
    const alert = payload.alerts.find((a) => a.id === "stage-failure-fetch");
    expect(alert).toBeDefined();
  });

  it("caps top publishers to TOP_N + Other", async () => {
    const sources = Array.from({ length: 15 }, (_, i) =>
      makeDataSource({ url: `https://publisher-${i}.com/article` }),
    );
    const provider = createDataCollectionInsightsProvider(
      makeDeps([makeRun()], [], sources),
    );
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find((s) => s.id === "where-publishers");
    if (section?.widget.kind !== "categoryBar") return;
    expect(section.widget.bars.length).toBeLessThanOrEqual(11);
    const hasOther = section.widget.bars.some((b) => b.label === "Other");
    expect(hasOther).toBe(true);
  });

  it("returns empty payload with schema-valid shape when no runs exist", async () => {
    const provider = createDataCollectionInsightsProvider(makeDeps([], [], []));
    const payload = await provider.compute({ window: "7d" });
    const result = insightsPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(payload.kpis.length).toBeGreaterThan(0);
    expect(payload.sections.length).toBeGreaterThan(0);
  });

  it("agentId field is set to data-collection", async () => {
    const provider = createDataCollectionInsightsProvider(makeDeps([], [], []));
    const payload = await provider.compute({ window: "7d" });
    expect(payload.agentId).toBe("data-collection");
  });
});
