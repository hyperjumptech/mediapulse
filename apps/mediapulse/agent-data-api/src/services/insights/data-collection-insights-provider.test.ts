/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";

import { createDataCollectionInsightsProvider } from "./data-collection-insights-provider.js";

function makeRun(
  overrides: {
    id?: string;
    tickerId?: string;
    startedAt?: Date;
    status?: string;
    agentId?: string | null;
    saved?: number;
    excluded?: number;
    byReason?: Record<string, number>;
    searchCredits?: number;
    fetchByProvider?: Record<string, number>;
    totalMs?: number;
  } = {},
) {
  const agentId =
    "agentId" in overrides ? overrides.agentId : "data-collection";
  return {
    id: overrides.id ?? "run-1",
    tickerId: overrides.tickerId ?? "ticker-1",
    startedAt:
      overrides.startedAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: overrides.status ?? "success",
    snapshot: {
      ...(agentId != null ? { agentId } : {}),
      cost: {
        searchCredits: overrides.searchCredits ?? 96,
        fetchByProvider: overrides.fetchByProvider ?? { jina: 10 },
      },
      result: {
        saved: overrides.saved ?? 10,
        excluded: overrides.excluded ?? 8,
        byReason: overrides.byReason ?? { existing: 5, freshness: 3 },
      },
      timing: { totalMs: overrides.totalMs ?? 30000 },
    },
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
      saved: 10,
      agentId: "data-collection",
    });
    const pageCollectionRun = makeRun({
      id: "pc-run",
      saved: 999,
      agentId: "page-collection",
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
      saved: 999,
      agentId: null,
    });
    const deps = makeDeps([runWithoutAgentId], [], []);
    const provider = createDataCollectionInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });
    const articleKpi = payload.kpis.find((k) => k.id === "articles_collected");
    expect(articleKpi?.value).toBe(0);
  });

  it("computes funnel with considered >= saved", async () => {
    const run = makeRun({ saved: 6, excluded: 14 });
    const provider = createDataCollectionInsightsProvider(
      makeDeps([run], [], []),
    );
    const payload = await provider.compute({ window: "7d" });
    const funnel = payload.sections.find((s) => s.id === "what-funnel");
    expect(funnel?.widget.kind).toBe("funnel");
    if (funnel?.widget.kind !== "funnel") return;
    const considered = funnel.widget.stages.find(
      (s) => s.label === "Considered",
    );
    const saved = funnel.widget.stages.find((s) => s.label === "Saved");
    expect(considered).toBeDefined();
    expect(saved).toBeDefined();
    expect(considered!.value).toBeGreaterThanOrEqual(saved!.value);
  });

  it("aggregates drop reasons from the run snapshot byReason", async () => {
    const run = makeRun({
      saved: 10,
      excluded: 10,
      byReason: { existing: 5, freshness: 3, contentQuality: 2 },
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
    expect(labels).toContain("existing");
    expect(labels).toContain("freshness");
    expect(labels).toContain("contentQuality");
  });

  it("drop reason fractions sum to 1", async () => {
    const run = makeRun({
      saved: 10,
      excluded: 10,
      byReason: { existing: 4, freshness: 6 },
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
      saved: 5,
    });
    const currentRun = makeRun({
      id: "current-run",
      startedAt: new Date(windowStart + 1000),
      saved: 15,
    });
    const provider = createDataCollectionInsightsProvider(
      makeDeps([priorRun, currentRun], [], []),
    );
    const payload = await provider.compute({ window: "7d" });
    const articleKpi = payload.kpis.find((k) => k.id === "articles_collected");
    expect(articleKpi?.value).toBe(15);
    expect(articleKpi?.delta).toBe(10);
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
