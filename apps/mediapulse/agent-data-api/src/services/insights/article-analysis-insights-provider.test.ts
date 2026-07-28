/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";

import { createArticleAnalysisInsightsProvider } from "./article-analysis-insights-provider.js";

function makeRelevance(overrides?: {
  dataSourceId?: string;
  tickerId?: string;
  symbol?: string;
  score?: number;
  scoreBreakdown?: unknown;
  selected?: boolean;
  scoredAt?: Date;
}) {
  return {
    dataSourceId: overrides?.dataSourceId ?? "ds-1",
    tickerId: overrides?.tickerId ?? "ticker-1",
    ticker: { symbol: overrides?.symbol ?? "AAPL" },
    score: overrides?.score ?? 0.7,
    scoreBreakdown:
      overrides?.scoreBreakdown !== undefined
        ? overrides.scoreBreakdown
        : {
            _version: 1,
            fundamental: 0.28,
            breakingNews: 0.25,
            sourceQuality: 0.49,
            tickerSalience: 1,
          },
    selected: overrides?.selected !== undefined ? overrides.selected : true,
    scoredAt: overrides?.scoredAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000),
  };
}

function makeDeps(relevances: ReturnType<typeof makeRelevance>[]) {
  return {
    articleRelevance: {
      findMany: async () => relevances,
    },
  };
}

describe("createArticleAnalysisInsightsProvider", () => {
  it("agentId is set to article-analysis", async () => {
    const provider = createArticleAnalysisInsightsProvider(makeDeps([]));
    const payload = await provider.compute({ window: "7d" });
    expect(payload.agentId).toBe("article-analysis");
  });

  it("articles_scored counts unique dataSourceIds", async () => {
    const rows = [
      makeRelevance({ dataSourceId: "ds-1", tickerId: "ticker-1" }),
      makeRelevance({ dataSourceId: "ds-1", tickerId: "ticker-2" }),
      makeRelevance({ dataSourceId: "ds-2", tickerId: "ticker-1" }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "articles_scored");
    expect(kpi?.value).toBe(2);
  });

  it("articles_selected counts rows where selected is true", async () => {
    const rows = [
      makeRelevance({ selected: true }),
      makeRelevance({ selected: true }),
      makeRelevance({ selected: false }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "articles_selected");
    expect(kpi?.value).toBe(2);
  });

  it("computes KPI delta between current and prior window", async () => {
    const windowMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const windowStart = now - windowMs;
    const priorStart = windowStart - windowMs;
    const priorRow = makeRelevance({
      dataSourceId: "ds-prior",
      scoredAt: new Date(priorStart + 1000),
      selected: true,
    });
    const currentRow = makeRelevance({
      dataSourceId: "ds-current",
      scoredAt: new Date(windowStart + 1000),
      selected: true,
    });
    const provider = createArticleAnalysisInsightsProvider(
      makeDeps([priorRow, currentRow]),
    );
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "articles_scored");
    expect(kpi?.value).toBe(1);
    expect(kpi?.delta).toBe(0);
  });

  it("emits low-selection-rate alert when < 20% with enough data", async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRelevance({ dataSourceId: `ds-${i}`, selected: i === 0 }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const alert = payload.alerts.find((a) => a.id === "low-selection-rate");
    expect(alert).toBeDefined();
  });

  it("does not emit low-selection-rate alert with fewer than 10 articles", async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeRelevance({ dataSourceId: `ds-${i}`, selected: false }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const alert = payload.alerts.find((a) => a.id === "low-selection-rate");
    expect(alert).toBeUndefined();
  });

  it("scores histogram has 5 buckets covering full 0-1 range", async () => {
    const rows = [
      makeRelevance({ score: 0.1 }),
      makeRelevance({ score: 0.3 }),
      makeRelevance({ score: 0.5 }),
      makeRelevance({ score: 0.7 }),
      makeRelevance({ score: 0.9 }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find(
      (s) => s.id === "why-score-distribution",
    );
    expect(section?.widget.kind).toBe("histogram");
    if (section?.widget.kind !== "histogram") return;
    expect(section.widget.buckets.length).toBe(5);
    const totalCount = section.widget.buckets.reduce(
      (sum, b) => sum + b.count,
      0,
    );
    expect(totalCount).toBe(5);
  });

  it("labels per-ticker bars with ticker symbol", async () => {
    const rows = [
      makeRelevance({ tickerId: "t1", symbol: "AAPL" }),
      makeRelevance({ tickerId: "t1", symbol: "AAPL" }),
      makeRelevance({ tickerId: "t2", symbol: "MSFT" }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find((s) => s.id === "where-per-ticker");
    if (section?.widget.kind !== "categoryBar") return;
    const labels = section.widget.bars.map((b) => b.label);
    expect(labels).toContain("AAPL");
    expect(labels).toContain("MSFT");
    expect(labels).not.toContain("t1");
    expect(labels).not.toContain("t2");
  });

  it("falls back to tickerId when ticker symbol is missing", async () => {
    const row = makeRelevance({ tickerId: "orphan-id", symbol: undefined });
    // Simulate missing symbol by overriding ticker
    const rowWithNoSymbol = {
      ...row,
      ticker: { symbol: undefined as unknown as string },
    };
    const provider = createArticleAnalysisInsightsProvider(
      makeDeps([rowWithNoSymbol]),
    );
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find((s) => s.id === "where-per-ticker");
    if (section?.widget.kind !== "categoryBar") return;
    const labels = section.widget.bars.map((b) => b.label);
    expect(labels).toContain("orphan-id");
  });

  it("caps per-ticker bars to TOP_N + Other", async () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      makeRelevance({
        dataSourceId: `ds-${i}`,
        tickerId: `ticker-${i}`,
        symbol: `SYM${i}`,
      }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find((s) => s.id === "where-per-ticker");
    if (section?.widget.kind !== "categoryBar") return;
    expect(section.widget.bars.length).toBeLessThanOrEqual(11);
    const hasOther = section.widget.bars.some((b) => b.label === "Other");
    expect(hasOther).toBe(true);
  });

  it("returns schema-valid empty payload when no data exists", async () => {
    const provider = createArticleAnalysisInsightsProvider(makeDeps([]));
    const payload = await provider.compute({ window: "7d" });
    const result = insightsPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(payload.kpis.length).toBeGreaterThan(0);
  });

  it("selection_rate KPI has tone critical when rate is below 20%", async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      makeRelevance({ dataSourceId: `ds-${i}`, selected: i === 0 }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "selection_rate");
    expect(kpi?.tone).toBe("critical");
  });

  it("selection_rate KPI has tone warning when rate is between 20% and 40%", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRelevance({ dataSourceId: `ds-${i}`, selected: i < 3 }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "selection_rate");
    expect(kpi?.tone).toBe("warning");
  });

  it("selection_rate KPI has tone positive when rate is 40% or above", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRelevance({ dataSourceId: `ds-${i}`, selected: i < 5 }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "selection_rate");
    expect(kpi?.tone).toBe("positive");
  });

  it("avg_relevance_score KPI has tone critical when avg score is below 0.3", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRelevance({ dataSourceId: `ds-${i}`, score: 0.1 }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "avg_relevance_score");
    expect(kpi?.tone).toBe("critical");
  });

  it("avg_relevance_score KPI has tone warning when avg score is 0.3 or above", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRelevance({ dataSourceId: `ds-${i}`, score: 0.5 }),
    );
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const kpi = payload.kpis.find((k) => k.id === "avg_relevance_score");
    expect(kpi?.tone).toBe("warning");
  });

  it("emits why-score-composition section when rows have parseable breakdowns", async () => {
    const rows = [
      makeRelevance({
        dataSourceId: "ds-1",
        scoreBreakdown: {
          _version: 1,
          fundamental: 0.28,
          breakingNews: 0.25,
          sourceQuality: 0.49,
          tickerSalience: 1,
        },
      }),
      makeRelevance({
        dataSourceId: "ds-2",
        scoreBreakdown: {
          _version: 1,
          fundamental: 0.3,
          breakingNews: 0.1,
          sourceQuality: 0.6,
          tickerSalience: 0.8,
        },
      }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find(
      (s) => s.id === "why-score-composition",
    );
    expect(section).toBeDefined();
    expect(section?.widget.kind).toBe("breakdown");
    if (section?.widget.kind !== "breakdown") return;
    expect(section.widget.slices.length).toBe(4);
    const totalFraction = section.widget.slices.reduce(
      (sum, s) => sum + s.fraction,
      0,
    );
    expect(totalFraction).toBeCloseTo(1, 5);
  });

  it("omits why-score-composition section when all breakdowns are null", async () => {
    const rows = [
      makeRelevance({ dataSourceId: "ds-1", scoreBreakdown: null }),
      makeRelevance({ dataSourceId: "ds-2", scoreBreakdown: null }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find(
      (s) => s.id === "why-score-composition",
    );
    expect(section).toBeUndefined();
  });

  it("omits why-score-composition section when breakdowns are legacy or malformed", async () => {
    const rows = [
      makeRelevance({
        dataSourceId: "ds-1",
        scoreBreakdown: { someOtherField: 1 },
      }),
      makeRelevance({ dataSourceId: "ds-2", scoreBreakdown: "legacy_string" }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find(
      (s) => s.id === "why-score-composition",
    );
    expect(section).toBeUndefined();
  });

  it("why-score-composition insight names the dominant driver", async () => {
    const rows = [
      makeRelevance({
        dataSourceId: "ds-1",
        scoreBreakdown: {
          _version: 1,
          fundamental: 0.1,
          breakingNews: 0.1,
          sourceQuality: 0.1,
          tickerSalience: 0.9,
        },
      }),
    ];
    const provider = createArticleAnalysisInsightsProvider(makeDeps(rows));
    const payload = await provider.compute({ window: "7d" });
    const section = payload.sections.find(
      (s) => s.id === "why-score-composition",
    );
    expect(section?.insight).toContain("ticker salience");
  });
});
