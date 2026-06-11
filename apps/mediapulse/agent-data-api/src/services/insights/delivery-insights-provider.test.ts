/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";

import { createDeliveryInsightsProvider } from "./delivery-insights-provider.js";

function makeRecipient(overrides?: {
  status?: string;
  attempts?: number;
  errorCategory?: string | null;
}) {
  return {
    status: overrides?.status ?? "success",
    attempts: overrides?.attempts ?? 1,
    errorCategory:
      overrides?.errorCategory !== undefined ? overrides.errorCategory : null,
  };
}

function makeRun(overrides?: {
  tickerId?: string;
  symbol?: string;
  outcome?: string;
  stage?: string | null;
  successCount?: number;
  failureCount?: number;
  skippedCount?: number;
  durationMs?: number;
  runSkipReason?: string | null;
  createdAt?: Date;
  recipients?: ReturnType<typeof makeRecipient>[];
}) {
  return {
    tickerId: overrides?.tickerId ?? "ticker-1",
    ticker: { symbol: overrides?.symbol ?? "AAPL" },
    outcome: overrides?.outcome ?? "success",
    stage: overrides?.stage !== undefined ? overrides.stage : null,
    successCount: overrides?.successCount ?? 3,
    failureCount: overrides?.failureCount ?? 0,
    skippedCount: overrides?.skippedCount ?? 0,
    durationMs: overrides?.durationMs ?? 5000,
    runSkipReason:
      overrides?.runSkipReason !== undefined ? overrides.runSkipReason : null,
    createdAt: overrides?.createdAt ?? new Date("2026-06-07T08:00:00.000Z"),
    recipients: overrides?.recipients ?? [
      makeRecipient(),
      makeRecipient(),
      makeRecipient(),
    ],
  };
}

function makeDeps(overrides?: { runs?: ReturnType<typeof makeRun>[] }) {
  const runs = overrides?.runs ?? [makeRun()];

  return {
    deliveryRun: {
      findMany: async () => runs,
    },
  };
}

describe("createDeliveryInsightsProvider", () => {
  it("returns a payload that parses through insightsPayloadSchema", async () => {
    const provider = createDeliveryInsightsProvider(makeDeps());
    const payload = await provider.compute({ window: "7d" });

    const parsed = insightsPayloadSchema.parse(payload);

    expect(parsed.agentId).toBe("delivery");
    expect(parsed.window).toBe("7d");
    expect(typeof parsed.generatedAt).toBe("string");
    expect(Array.isArray(parsed.kpis)).toBe(true);
    expect(Array.isArray(parsed.alerts)).toBe(true);
    expect(Array.isArray(parsed.sections)).toBe(true);
  });

  it("outcome breakdown counts each DeliveryRunOutcome correctly", async () => {
    const provider = createDeliveryInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success" }),
          makeRun({ outcome: "success" }),
          makeRun({ outcome: "partial_success", failureCount: 1 }),
          makeRun({ outcome: "failed", stage: "send" }),
          makeRun({ outcome: "skipped", runSkipReason: "no_newsletter" }),
          makeRun({ outcome: "skipped_all_already_delivered" }),
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
      const successSlice = outcomeSection!.widget.slices.find(
        (s) => s.label === "Success",
      );
      const partialSlice = outcomeSection!.widget.slices.find(
        (s) => s.label === "Partial success",
      );
      const failedSlice = outcomeSection!.widget.slices.find(
        (s) => s.label === "Failed",
      );
      expect(successSlice?.value).toBe(2);
      expect(partialSlice?.value).toBe(1);
      expect(failedSlice?.value).toBe(1);
      const fractionSum = outcomeSection!.widget.slices.reduce(
        (sum, s) => sum + s.fraction,
        0,
      );
      expect(fractionSum).toBeCloseTo(1);
    }
  });

  it("recipient funnel: attempted >= succeeded and succeeds == sum of successCount from active runs", async () => {
    const provider = createDeliveryInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "success", successCount: 5, failureCount: 0 }),
          makeRun({
            outcome: "partial_success",
            successCount: 3,
            failureCount: 2,
          }),
          makeRun({
            outcome: "skipped",
            successCount: 0,
            failureCount: 0,
            runSkipReason: "no_newsletter",
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const funnelSection = payload.sections.find(
      (s) => s.id === "who-recipient-funnel",
    );

    expect(funnelSection).toBeDefined();
    expect(funnelSection!.widget.kind).toBe("funnel");
    if (funnelSection!.widget.kind === "funnel") {
      const attempted = funnelSection!.widget.stages.find(
        (s) => s.label === "Attempted",
      );
      const delivered = funnelSection!.widget.stages.find(
        (s) => s.label === "Delivered",
      );
      expect(attempted?.value).toBe(10);
      expect(delivered?.value).toBe(8);
      expect(attempted!.value).toBeGreaterThanOrEqual(delivered!.value);
    }
  });

  it("error category breakdown aggregates only failed recipients", async () => {
    const provider = createDeliveryInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            outcome: "partial_success",
            successCount: 2,
            failureCount: 2,
            recipients: [
              makeRecipient({ status: "success" }),
              makeRecipient({ status: "success" }),
              makeRecipient({
                status: "failed",
                errorCategory: "resend_rate_limited",
              }),
              makeRecipient({
                status: "failed",
                errorCategory: "resend_transient",
              }),
            ],
          }),
          makeRun({
            outcome: "success",
            successCount: 1,
            recipients: [makeRecipient({ status: "success" })],
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const errorSection = payload.sections.find(
      (s) => s.id === "why-error-category",
    );

    expect(errorSection).toBeDefined();
    expect(errorSection!.widget.kind).toBe("breakdown");
    if (errorSection!.widget.kind === "breakdown") {
      const totalInBreakdown = errorSection!.widget.slices.reduce(
        (sum, s) => sum + s.value,
        0,
      );
      expect(totalInBreakdown).toBe(2);
      const rateLimitSlice = errorSection!.widget.slices.find(
        (s) => s.label === "resend_rate_limited",
      );
      expect(rateLimitSlice?.value).toBe(1);
    }
  });

  it("attempts histogram buckets recipients by attempt count, skipping skipped recipients", async () => {
    const provider = createDeliveryInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            outcome: "partial_success",
            recipients: [
              makeRecipient({ status: "success", attempts: 1 }),
              makeRecipient({ status: "success", attempts: 3 }),
              makeRecipient({ status: "failed", attempts: 4 }),
              makeRecipient({ status: "skipped", attempts: 0 }),
            ],
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const histogramSection = payload.sections.find(
      (s) => s.id === "how-attempts-histogram",
    );

    expect(histogramSection).toBeDefined();
    expect(histogramSection!.widget.kind).toBe("histogram");
    if (histogramSection!.widget.kind === "histogram") {
      const totalBucketCount = histogramSection!.widget.buckets.reduce(
        (sum, b) => sum + b.count,
        0,
      );
      expect(totalBucketCount).toBe(3);
      const oneBucket = histogramSection!.widget.buckets.find(
        (b) => b.label === "1 attempt",
      );
      expect(oneBucket?.count).toBe(1);
      const fourPlusBucket = histogramSection!.widget.buckets.find(
        (b) => b.label === "4+ attempts",
      );
      expect(fourPlusBucket?.count).toBe(1);
    }
  });

  it("KPI includes a numeric delta for runs and recipients_reached", async () => {
    const provider = createDeliveryInsightsProvider(
      makeDeps({
        runs: [
          makeRun({
            createdAt: new Date("2026-06-07T08:00:00.000Z"),
            successCount: 4,
          }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const runsKpi = payload.kpis.find((k) => k.id === "runs");
    const recipientsKpi = payload.kpis.find(
      (k) => k.id === "recipients_reached",
    );

    expect(runsKpi).toBeDefined();
    expect(runsKpi!.value).toBe(1);
    expect(typeof runsKpi!.delta).toBe("number");
    expect(recipientsKpi).toBeDefined();
    expect(recipientsKpi!.value).toBe(4);
    expect(typeof recipientsKpi!.delta).toBe("number");
  });

  it("labels per-ticker delivery bars with ticker symbol", async () => {
    const runs = [
      makeRun({ tickerId: "t1", symbol: "AAPL" }),
      makeRun({ tickerId: "t1", symbol: "AAPL" }),
      makeRun({ tickerId: "t2", symbol: "MSFT" }),
    ];

    const provider = createDeliveryInsightsProvider(makeDeps({ runs }));
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

  it("falls back to tickerId when ticker symbol is missing", async () => {
    const run = makeRun({ tickerId: "orphan-id" });
    const runWithNoSymbol = { ...run, ticker: { symbol: undefined as unknown as string } };

    const provider = createDeliveryInsightsProvider(
      makeDeps({ runs: [runWithNoSymbol] }),
    );

    const payload = await provider.compute({ window: "7d" });
    const tickerBar = payload.sections.find((s) => s.id === "where-per-ticker");

    if (tickerBar?.widget.kind === "categoryBar") {
      const labels = tickerBar.widget.bars.map((b) => b.label);
      expect(labels).toContain("orphan-id");
    }
  });

  it("caps per-ticker delivery bars at TOP_N + Other bucket", async () => {
    const manyRuns = Array.from({ length: 15 }, (_, index) =>
      makeRun({ tickerId: `ticker-${index}`, symbol: `SYM${index}` }),
    );

    const provider = createDeliveryInsightsProvider(
      makeDeps({ runs: manyRuns }),
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

  it("emits a stage-failure alert when runs fail at send or fetch stage", async () => {
    const provider = createDeliveryInsightsProvider(
      makeDeps({
        runs: [
          makeRun({ outcome: "failed", stage: "send", recipients: [] }),
          makeRun({ outcome: "success" }),
        ],
      }),
    );

    const payload = await provider.compute({ window: "7d" });
    const stageAlert = payload.alerts.find((a) =>
      a.id.startsWith("stage-failure-"),
    );

    expect(stageAlert).toBeDefined();
    expect(stageAlert!.severity).toBe("warning");
  });

  it("returns a valid payload when all inputs are empty", async () => {
    const provider = createDeliveryInsightsProvider(makeDeps({ runs: [] }));

    const payload = await provider.compute({ window: "7d" });
    const parsed = insightsPayloadSchema.parse(payload);

    expect(parsed.kpis.length).toBeGreaterThanOrEqual(3);
    expect(parsed.alerts).toHaveLength(0);
    expect(parsed.sections.length).toBeGreaterThanOrEqual(1);
  });
});
