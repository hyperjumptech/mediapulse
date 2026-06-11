/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";

import { createContentGenerationInsightsProvider } from "./content-generation-insights-provider.js";

function makeRun(overrides?: {
  tickerId?: string;
  outcome?: string;
  stage?: string | null;
  errorCode?: string | null;
  errorCategory?: string | null;
  durationMs?: number | null;
  createdAt?: Date;
  details?: object | null;
}) {
  return {
    tickerId: overrides?.tickerId ?? "ticker-1",
    outcome: overrides?.outcome ?? "success",
    stage: overrides?.stage !== undefined ? overrides.stage : null,
    errorCode: overrides?.errorCode !== undefined ? overrides.errorCode : null,
    errorCategory:
      overrides?.errorCategory !== undefined ? overrides.errorCategory : null,
    durationMs:
      overrides?.durationMs !== undefined ? overrides.durationMs : 10000,
    createdAt: overrides?.createdAt ?? new Date("2026-06-07T08:00:00.000Z"),
    details: overrides?.details !== undefined ? overrides.details : null,
  };
}

function makeNewsletter(overrides?: {
  tickerId?: string;
  symbol?: string;
  createdAt?: Date;
  model?: string | null;
  totalTokens?: number | null;
}) {
  return {
    tickerId: overrides?.tickerId ?? "ticker-1",
    ticker: { symbol: overrides?.symbol ?? "AAPL" },
    createdAt: overrides?.createdAt ?? new Date("2026-06-07T08:00:00.000Z"),
    model: overrides?.model !== undefined ? overrides.model : "gpt-4o",
    totalTokens:
      overrides?.totalTokens !== undefined ? overrides.totalTokens : 1500,
  };
}

function makeDeps(overrides?: {
  runs?: ReturnType<typeof makeRun>[];
  newsletters?: ReturnType<typeof makeNewsletter>[];
}) {
  const runs = overrides?.runs ?? [makeRun()];
  const newsletters = overrides?.newsletters ?? [makeNewsletter()];

  return {
    contentGenerationRun: {
      findMany: async () => runs,
    },
    newsletter: {
      findMany: async () => newsletters,
    },
  };
}

describe("createContentGenerationInsightsProvider", () => {
  it("returns a payload that parses through insightsPayloadSchema", async () => {
    const provider = createContentGenerationInsightsProvider(makeDeps());
    const payload = await provider.compute({ window: "7d" });

    const parsed = insightsPayloadSchema.parse(payload);

    expect(parsed.agentId).toBe("content-generation");
    expect(parsed.window).toBe("7d");
    expect(typeof parsed.generatedAt).toBe("string");
    expect(Array.isArray(parsed.kpis)).toBe(true);
    expect(Array.isArray(parsed.alerts)).toBe(true);
    expect(Array.isArray(parsed.sections)).toBe(true);
  });

  it("outcome breakdown fractions sum to 1", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success" }),
          makeRun({ outcome: "success" }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "skipped",
            stage: "precheck",
            errorCode: "no_sources",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const outcomeSection = payload.sections.find(
      (s) => s.id === "what-outcome",
    );

    expect(outcomeSection).toBeDefined();
    expect(outcomeSection!.widget.kind).toBe("breakdown");
    if (outcomeSection!.widget.kind === "breakdown") {
      const fractionSum = outcomeSection!.widget.slices.reduce(
        (sum, s) => sum + s.fraction,
        0,
      );
      expect(fractionSum).toBeCloseTo(1);
    }
  });

  it("failure-by-stage breakdown counts only failed runs", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success" }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "skipped",
            stage: "precheck",
            errorCode: "no_sources",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const failureSection = payload.sections.find(
      (s) => s.id === "why-failure-by-stage",
    );

    expect(failureSection).toBeDefined();
    expect(failureSection!.widget.kind).toBe("breakdown");
    if (failureSection!.widget.kind === "breakdown") {
      const totalInBreakdown = failureSection!.widget.slices.reduce(
        (sum, s) => sum + s.value,
        0,
      );
      expect(totalInBreakdown).toBe(2);
      const llmSlice = failureSection!.widget.slices.find(
        (s) => s.label === "llm",
      );
      expect(llmSlice?.value).toBe(2);
    }
  });

  it("skip-reason breakdown counts only skipped runs", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success" }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "skipped",
            stage: "precheck",
            errorCode: "no_sources",
          }),
          makeRun({
            outcome: "skipped",
            stage: "precheck",
            errorCode: "skipped_fresh_newsletter_exists",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const skipSection = payload.sections.find(
      (s) => s.id === "why-skip-reason",
    );

    expect(skipSection).toBeDefined();
    expect(skipSection!.widget.kind).toBe("breakdown");
    if (skipSection!.widget.kind === "breakdown") {
      const totalInBreakdown = skipSection!.widget.slices.reduce(
        (sum, s) => sum + s.value,
        0,
      );
      expect(totalInBreakdown).toBe(2);
      const noSourcesSlice = skipSection!.widget.slices.find(
        (s) => s.label === "no_sources",
      );
      expect(noSourcesSlice?.value).toBe(1);
    }
  });

  it("section-fill sums citedBullets per section from run details", async () => {
    const makeDetails = (bullets: Record<string, number>) => ({
      sectionFill: {
        bySection: Object.fromEntries(
          Object.entries(bullets).map(([k, v]) => [k, { citedBullets: v }]),
        ),
      },
    });

    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            outcome: "success",
            details: makeDetails({ intro: 3, body: 5 }),
          }),
          makeRun({
            outcome: "success",
            details: makeDetails({ intro: 2, body: 4, conclusion: 1 }),
          }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            details: makeDetails({ intro: 99 }),
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const fillSection = payload.sections.find(
      (s) => s.id === "how-section-fill",
    );

    expect(fillSection).toBeDefined();
    expect(fillSection!.widget.kind).toBe("categoryBar");
    if (fillSection!.widget.kind === "categoryBar") {
      const introBar = fillSection!.widget.bars.find(
        (b) => b.label === "intro",
      );
      const bodyBar = fillSection!.widget.bars.find((b) => b.label === "body");
      const conclusionBar = fillSection!.widget.bars.find(
        (b) => b.label === "conclusion",
      );
      expect(introBar?.value).toBe(5);
      expect(bodyBar?.value).toBe(9);
      expect(conclusionBar?.value).toBe(1);
    }
  });

  it("stage funnel has monotonically non-increasing counts", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success" }),
          makeRun({ outcome: "success" }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "skipped",
            stage: "precheck",
            errorCode: "no_sources",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const funnelSection = payload.sections.find(
      (s) => s.id === "what-stage-funnel",
    );

    expect(funnelSection).toBeDefined();
    expect(funnelSection!.widget.kind).toBe("funnel");
    if (funnelSection!.widget.kind === "funnel") {
      const values = funnelSection!.widget.stages.map((s) => s.value);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]!);
      }
    }
  });

  it("KPI includes a numeric delta for runs", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [makeRun({ createdAt: new Date("2026-06-07T08:00:00.000Z") })],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const runsKpi = payload.kpis.find((k) => k.id === "runs");

    expect(runsKpi).toBeDefined();
    expect(runsKpi!.value).toBe(1);
    expect(typeof runsKpi!.delta).toBe("number");
  });

  it("labels per-ticker newsletter bars with ticker symbol", async () => {
    const newsletters = [
      makeNewsletter({ tickerId: "t1", symbol: "AAPL" }),
      makeNewsletter({ tickerId: "t1", symbol: "AAPL" }),
      makeNewsletter({ tickerId: "t2", symbol: "MSFT" }),
    ];

    const provider = createContentGenerationInsightsProvider(
      makeDeps({ newsletters }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tickerBar = payload.sections.find((s) => s.id === "where-per-ticker");

    expect(tickerBar).toBeDefined();
    if (tickerBar!.widget.kind === "categoryBar") {
      const labels = tickerBar!.widget.bars.map((b) => b.label);
      expect(labels).toContain("AAPL");
      expect(labels).toContain("MSFT");
      expect(labels).not.toContain("t1");
      expect(labels).not.toContain("t2");
    }
  });

  it("falls back to tickerId when newsletter ticker symbol is missing", async () => {
    const newsletter = makeNewsletter({ tickerId: "orphan-id" });
    const newsletterWithNoSymbol = {
      ...newsletter,
      ticker: { symbol: undefined as unknown as string },
    };

    const provider = createContentGenerationInsightsProvider(
      makeDeps({ newsletters: [newsletterWithNoSymbol] }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tickerBar = payload.sections.find((s) => s.id === "where-per-ticker");

    if (tickerBar?.widget.kind === "categoryBar") {
      const labels = tickerBar.widget.bars.map((b) => b.label);
      expect(labels).toContain("orphan-id");
    }
  });

  it("caps per-ticker bars at TOP_N + Other bucket", async () => {
    const manyNewsletters = Array.from({ length: 15 }, (_, index) =>
      makeNewsletter({ tickerId: `ticker-${index}`, symbol: `SYM${index}` }),
    );

    const provider = createContentGenerationInsightsProvider(
      makeDeps({ newsletters: manyNewsletters }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tickerBar = payload.sections.find((s) => s.id === "where-per-ticker");

    expect(tickerBar).toBeDefined();
    if (tickerBar!.widget.kind === "categoryBar") {
      expect(tickerBar!.widget.bars.length).toBeLessThanOrEqual(11);
      const other = tickerBar!.widget.bars.find((b) => b.label === "Other");
      expect(other).toBeDefined();
    }
  });

  it("model mix fractions sum to 1", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({ model: "gpt-4o" }),
          makeNewsletter({ model: "gpt-4o" }),
          makeNewsletter({ model: "gpt-4o-mini" }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const modelSection = payload.sections.find((s) => s.id === "who-model-mix");

    expect(modelSection).toBeDefined();
    if (modelSection!.widget.kind === "breakdown") {
      const fractionSum = modelSection!.widget.slices.reduce(
        (sum, s) => sum + s.fraction,
        0,
      );
      expect(fractionSum).toBeCloseTo(1);
      const gpt4oSlice = modelSection!.widget.slices.find(
        (s) => s.label === "gpt-4o",
      );
      expect(gpt4oSlice?.value).toBe(2);
    }
  });

  it("median duration excludes null durationMs values", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            outcome: "skipped",
            stage: "precheck",
            errorCode: "no_sources",
            durationMs: null,
          }),
          makeRun({ outcome: "success", durationMs: 10000 }),
          makeRun({ outcome: "success", durationMs: 20000 }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const medianKpi = payload.kpis.find((k) => k.id === "median_duration_ms");

    expect(medianKpi).toBeDefined();
    expect(medianKpi!.value).toBe(15000);
  });

  it("emits a high-failure-rate alert when failure rate exceeds 20%", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({ outcome: "success" }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const failAlert = payload.alerts.find((a) => a.id === "high-failure-rate");

    expect(failAlert).toBeDefined();
    expect(failAlert!.severity).toBe("warning");
  });

  it("returns a valid payload when all inputs are empty", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({ runs: [], newsletters: [] }),
    );

    const payload = await provider.compute({ window: "7d" });
    const parsed = insightsPayloadSchema.parse(payload);

    expect(parsed.kpis.length).toBeGreaterThanOrEqual(3);
    expect(parsed.alerts).toHaveLength(0);
    expect(parsed.sections.length).toBeGreaterThanOrEqual(1);
  });
});
