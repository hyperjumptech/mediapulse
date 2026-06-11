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
  promptTokens?: number | null;
  completionTokens?: number | null;
  configVersion?: string | null;
  promptHash?: string | null;
}) {
  return {
    tickerId: overrides?.tickerId ?? "ticker-1",
    ticker: { symbol: overrides?.symbol ?? "AAPL" },
    createdAt: overrides?.createdAt ?? new Date("2026-06-07T08:00:00.000Z"),
    model: overrides?.model !== undefined ? overrides.model : "gpt-4o",
    totalTokens:
      overrides?.totalTokens !== undefined ? overrides.totalTokens : 1500,
    promptTokens:
      overrides?.promptTokens !== undefined ? overrides.promptTokens : null,
    completionTokens:
      overrides?.completionTokens !== undefined
        ? overrides.completionTokens
        : null,
    configVersion:
      overrides?.configVersion !== undefined ? overrides.configVersion : null,
    promptHash:
      overrides?.promptHash !== undefined ? overrides.promptHash : null,
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

  it("model mix section is a table with model, configVersion, and promptHash rows", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({
            model: "gpt-4o",
            configVersion: "v1",
            promptHash: "abc",
          }),
          makeNewsletter({
            model: "gpt-4o",
            configVersion: "v1",
            promptHash: "abc",
          }),
          makeNewsletter({
            model: "gpt-4o-mini",
            configVersion: "v1",
            promptHash: "abc",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const modelSection = payload.sections.find((s) => s.id === "who-model-mix");

    expect(modelSection).toBeDefined();
    expect(modelSection!.widget.kind).toBe("table");
    if (modelSection!.widget.kind === "table") {
      expect(modelSection!.widget.columns).toContain("dimension");
      const modelRows = modelSection!.widget.rows.filter(
        (row) => row[0] === "model",
      );
      expect(modelRows.length).toBeGreaterThan(0);
      const gpt4oRow = modelRows.find((row) => row[1] === "gpt-4o");
      expect(gpt4oRow).toBeDefined();
      expect(gpt4oRow![2]).toBe(2);
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

  // Task 1: no how-median-duration section; duration histogram still present
  it("does not emit how-median-duration section but still emits duration histogram", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success", durationMs: 5000 }),
          makeRun({ outcome: "success", durationMs: 10000 }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });

    const medianDurationSection = payload.sections.find(
      (s) => s.id === "how-median-duration",
    );
    const histogramSection = payload.sections.find(
      (s) => s.id === "how-duration-histogram",
    );

    expect(medianDurationSection).toBeUndefined();
    expect(histogramSection).toBeDefined();
    expect(histogramSection!.widget.kind).toBe("histogram");
  });

  // Task 2: KPI tones -- success_rate warning when below 80%
  it("success_rate KPI has warning tone when success rate is below 80%", async () => {
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
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const successRateKpi = payload.kpis.find((k) => k.id === "success_rate");

    expect(successRateKpi).toBeDefined();
    // 1 success out of 5 runs = 20%, which is below 60% (critical threshold) -- not testing critical here
    // but we can assert tone is set to something other than undefined
    expect(successRateKpi!.tone).toBeDefined();
    // 20% success rate is below 60% so critical
    expect(successRateKpi!.tone).toBe("critical");
  });

  it("success_rate KPI has warning tone when between 60% and 80%", async () => {
    // 2 success out of 3 runs = 67%, below 80% but above 60%
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
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const successRateKpi = payload.kpis.find((k) => k.id === "success_rate");

    expect(successRateKpi).toBeDefined();
    expect(successRateKpi!.tone).toBe("warning");
  });

  it("success_rate KPI has no tone when success rate is 80% or above", async () => {
    // 4 success out of 5 = 80%
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success" }),
          makeRun({ outcome: "success" }),
          makeRun({ outcome: "success" }),
          makeRun({ outcome: "success" }),
          makeRun({
            outcome: "failed",
            stage: "llm",
            errorCategory: "retryable_llm",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const successRateKpi = payload.kpis.find((k) => k.id === "success_rate");

    expect(successRateKpi).toBeDefined();
    expect(successRateKpi!.tone).toBeUndefined();
  });

  it("median_duration_ms KPI has warning tone when above 2 minutes", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success", durationMs: 130_000 }), // 2 min 10s
          makeRun({ outcome: "success", durationMs: 150_000 }), // 2 min 30s
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const medianKpi = payload.kpis.find((k) => k.id === "median_duration_ms");

    expect(medianKpi).toBeDefined();
    expect(medianKpi!.tone).toBe("warning");
  });

  it("median_duration_ms KPI has no tone when below 2 minutes", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success", durationMs: 10_000 }),
          makeRun({ outcome: "success", durationMs: 20_000 }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const medianKpi = payload.kpis.find((k) => k.id === "median_duration_ms");

    expect(medianKpi).toBeDefined();
    expect(medianKpi!.tone).toBeUndefined();
  });

  // Task 3: section-coverage -- sectionsRemoved surfaced and alert fires when consistently dropped
  it("what-section-coverage section shows removed counts from sectionsRemoved", async () => {
    const makeDetailsWithRemoved = (
      bullets: Record<string, number>,
      removed: string[],
    ) => ({
      sectionFill: {
        bySection: Object.fromEntries(
          Object.entries(bullets).map(([k, v]) => [k, { citedBullets: v }]),
        ),
        sectionsRemoved: removed,
      },
    });

    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved({ industryPulse: 3 }, [
              "regulatoryPolicyWatch",
            ]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved({ industryPulse: 2 }, [
              "regulatoryPolicyWatch",
            ]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved({ industryPulse: 4 }, []),
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const coverageSection = payload.sections.find(
      (s) => s.id === "what-section-coverage",
    );

    expect(coverageSection).toBeDefined();
    expect(coverageSection!.widget.kind).toBe("table");
    if (coverageSection!.widget.kind === "table") {
      const regRow = coverageSection!.widget.rows.find(
        (row) => row[0] === "regulatoryPolicyWatch",
      );
      expect(regRow).toBeDefined();
      expect(regRow![2]).toBe(2); // removed_count
    }
  });

  it("fires section-drop alert when a section is removed in >20% of successful runs", async () => {
    const makeDetailsWithRemoved = (removed: string[]) => ({
      sectionFill: {
        bySection: { industryPulse: { citedBullets: 2 } },
        sectionsRemoved: removed,
      },
    });

    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          // 3 out of 4 success runs have regulatoryPolicyWatch removed = 75%
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved(["regulatoryPolicyWatch"]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved(["regulatoryPolicyWatch"]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved(["regulatoryPolicyWatch"]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved([]),
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const dropAlert = payload.alerts.find(
      (a) => a.id === "section-drop-regulatoryPolicyWatch",
    );

    expect(dropAlert).toBeDefined();
    expect(dropAlert!.severity).toBe("warning");
    expect(dropAlert!.sectionRef).toBe("what-section-coverage");
  });

  it("does not fire section-drop alert when drop rate is at or below 20%", async () => {
    const makeDetailsWithRemoved = (removed: string[]) => ({
      sectionFill: {
        bySection: { industryPulse: { citedBullets: 2 } },
        sectionsRemoved: removed,
      },
    });

    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          // 1 out of 5 = 20%, which is NOT above the threshold (threshold is >20%)
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved(["regulatoryPolicyWatch"]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved([]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved([]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved([]),
          }),
          makeRun({
            outcome: "success",
            details: makeDetailsWithRemoved([]),
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const dropAlert = payload.alerts.find(
      (a) => a.id === "section-drop-regulatoryPolicyWatch",
    );

    expect(dropAlert).toBeUndefined();
  });

  it("handles runs with no details gracefully for section coverage", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success", details: null }),
          makeRun({ outcome: "success", details: null }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });

    // No section-fill or coverage sections should appear when details are missing
    const coverageSection = payload.sections.find(
      (s) => s.id === "what-section-coverage",
    );
    const fillSection = payload.sections.find(
      (s) => s.id === "how-section-fill",
    );
    const parsed = insightsPayloadSchema.parse(payload);

    expect(coverageSection).toBeUndefined();
    expect(fillSection).toBeUndefined();
    expect(parsed).toBeDefined();
  });

  // Task 4: token cost depth
  it("avg_tokens_per_newsletter KPI is correct", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({ totalTokens: 1000 }),
          makeNewsletter({ totalTokens: 2000 }),
          makeNewsletter({ totalTokens: 3000 }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const avgKpi = payload.kpis.find(
      (k) => k.id === "avg_tokens_per_newsletter",
    );

    expect(avgKpi).toBeDefined();
    expect(avgKpi!.value).toBe(2000);
    expect(avgKpi!.unit).toBe("tokens");
  });

  it("avg_tokens_per_newsletter KPI is absent when there are no newsletters", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({ runs: [], newsletters: [] }),
    );

    const payload = await provider.compute({ window: "7d" });
    const avgKpi = payload.kpis.find(
      (k) => k.id === "avg_tokens_per_newsletter",
    );

    expect(avgKpi).toBeUndefined();
  });

  it("prompt vs completion token section shows split when both are present", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({
            totalTokens: 1000,
            promptTokens: 800,
            completionTokens: 200,
          }),
          makeNewsletter({
            totalTokens: 2000,
            promptTokens: 1600,
            completionTokens: 400,
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tokenSection = payload.sections.find(
      (s) => s.id === "how-prompt-vs-completion-tokens",
    );

    expect(tokenSection).toBeDefined();
    expect(tokenSection!.widget.kind).toBe("breakdown");
    if (tokenSection!.widget.kind === "breakdown") {
      const promptSlice = tokenSection!.widget.slices.find(
        (s) => s.label === "Prompt",
      );
      const completionSlice = tokenSection!.widget.slices.find(
        (s) => s.label === "Completion",
      );
      expect(promptSlice).toBeDefined();
      expect(completionSlice).toBeDefined();
      expect(promptSlice!.value).toBe(2400); // 800 + 1600
      expect(completionSlice!.value).toBe(600); // 200 + 400
      // prompt + completion should reconcile to total
      expect(promptSlice!.value + completionSlice!.value).toBe(3000);
      // fractions should sum to 1
      expect(promptSlice!.fraction + completionSlice!.fraction).toBeCloseTo(1);
    }
  });

  it("prompt vs completion token section is absent when all newsletters have null tokens", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({
            totalTokens: 1500,
            promptTokens: null,
            completionTokens: null,
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tokenSection = payload.sections.find(
      (s) => s.id === "how-prompt-vs-completion-tokens",
    );

    expect(tokenSection).toBeUndefined();
  });

  it("prompt vs completion token section only counts newsletters with both values", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({
            totalTokens: 1000,
            promptTokens: 800,
            completionTokens: 200,
          }),
          // This newsletter has null tokens and should be excluded from the split
          makeNewsletter({
            totalTokens: 500,
            promptTokens: null,
            completionTokens: null,
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tokenSection = payload.sections.find(
      (s) => s.id === "how-prompt-vs-completion-tokens",
    );

    expect(tokenSection).toBeDefined();
    if (tokenSection!.widget.kind === "breakdown") {
      const promptSlice = tokenSection!.widget.slices.find(
        (s) => s.label === "Prompt",
      );
      // Only the first newsletter should be counted
      expect(promptSlice!.value).toBe(800);
    }
  });

  // Task 5: config-version-drift
  it("config-version-drift alert fires when multiple configVersions are active", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({ configVersion: "v1", promptHash: "abc" }),
          makeNewsletter({ configVersion: "v2", promptHash: "abc" }),
          makeNewsletter({ configVersion: "v1", promptHash: "abc" }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const driftAlert = payload.alerts.find(
      (a) => a.id === "config-version-drift",
    );

    expect(driftAlert).toBeDefined();
    expect(driftAlert!.severity).toBe("warning");
    expect(driftAlert!.sectionRef).toBe("who-model-mix");
  });

  it("prompt-hash-drift alert fires when multiple promptHashes are active", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({ configVersion: "v1", promptHash: "abc" }),
          makeNewsletter({ configVersion: "v1", promptHash: "def" }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const driftAlert = payload.alerts.find((a) => a.id === "prompt-hash-drift");

    expect(driftAlert).toBeDefined();
    expect(driftAlert!.severity).toBe("warning");
  });

  it("no config-version-drift alert when all newsletters share the same configVersion", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({ configVersion: "v1", promptHash: "abc" }),
          makeNewsletter({ configVersion: "v1", promptHash: "abc" }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const driftAlert = payload.alerts.find(
      (a) => a.id === "config-version-drift",
    );
    const promptDriftAlert = payload.alerts.find(
      (a) => a.id === "prompt-hash-drift",
    );

    expect(driftAlert).toBeUndefined();
    expect(promptDriftAlert).toBeUndefined();
  });

  it("who-model-mix table includes configVersion and promptHash rows", async () => {
    const provider = createContentGenerationInsightsProvider(
      makeDeps({
        newsletters: [
          makeNewsletter({
            model: "gpt-4o",
            configVersion: "v1",
            promptHash: "hash1",
          }),
          makeNewsletter({
            model: "gpt-4o",
            configVersion: "v2",
            promptHash: "hash2",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const modelSection = payload.sections.find((s) => s.id === "who-model-mix");

    expect(modelSection).toBeDefined();
    expect(modelSection!.widget.kind).toBe("table");
    if (modelSection!.widget.kind === "table") {
      const configVersionRows = modelSection!.widget.rows.filter(
        (row) => row[0] === "configVersion",
      );
      const promptHashRows = modelSection!.widget.rows.filter(
        (row) => row[0] === "promptHash",
      );
      expect(configVersionRows.length).toBeGreaterThan(0);
      expect(promptHashRows.length).toBeGreaterThan(0);
    }
  });
});
