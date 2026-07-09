import { describe, expect, it, vi } from "vitest";

import { buildChronicle, type BuildChronicleDeps } from "./build-chronicle";

const NEWSLETTER = {
  id: "nl-1",
  tickerId: "tk-1",
  subject: "BBRI daily brief",
  createdAt: new Date("2026-06-30T06:05:00.000Z"),
  model: "gpt-4o",
  promptTokens: 14_200,
  completionTokens: 3_050,
  totalTokens: 17_250,
};

const makeDeps = (
  overrides: Partial<BuildChronicleDeps>,
): BuildChronicleDeps => ({
  searchQuerySet: { findMany: vi.fn().mockResolvedValue([]) },
  dataCollectionRun: { findMany: vi.fn().mockResolvedValue([]) },
  pageCollectionRun: { findMany: vi.fn().mockResolvedValue([]) },
  dataSourceTickerSection: { findMany: vi.fn().mockResolvedValue([]) },
  articleAnalysisRun: { findMany: vi.fn().mockResolvedValue([]) },
  contentGenerationRun: { findFirst: vi.fn().mockResolvedValue(null) },
  deliveryRun: { findMany: vi.fn().mockResolvedValue([]) },
  ...overrides,
});

const stageByName = (
  result: Awaited<ReturnType<typeof buildChronicle>>,
  stage: string,
) => result.stages.find((s) => s.stage === stage)!;

describe("buildChronicle", () => {
  it("returns empty upstream stages and a skipped delivery when nothing exists", async () => {
    const result = await buildChronicle(NEWSLETTER, makeDeps({}));

    expect(result.stages).toHaveLength(6);
    expect(result.upstreamRunCount).toBe(0);
    expect(result.totalSearchCredits).toBe(0);
    expect(stageByName(result, "query-analysis").status).toBe("empty");
    expect(stageByName(result, "delivery").status).toBe("skipped");
    // Content generation with a newsletter but no run row still counts its tokens.
    expect(result.totalTokens).toBe(17_250);
    expect(result.overallStatus).toBe("skipped");
  });

  it("aggregates upstream runs across the window and splits page vs data collection by agentId", async () => {
    const deps = makeDeps({
      searchQuerySet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "qs-1",
            generatedAt: new Date("2026-06-30T06:00:00.000Z"),
            strategySnapshot: {
              queryCount: 12,
              llmUsage: {
                model: "gpt-4o",
                promptTokens: 2_000,
                completionTokens: 500,
                totalTokens: 2_500,
                embeddingTokens: 100,
                calls: 3,
              },
              timing: { durationMs: 1_800 },
            },
          },
          {
            id: "qs-2",
            generatedAt: new Date("2026-06-29T18:00:00.000Z"),
            strategySnapshot: {
              llmUsage: {
                model: "gpt-4o",
                promptTokens: 1_000,
                completionTokens: 200,
                totalTokens: 1_200,
                embeddingTokens: 0,
                calls: 2,
              },
            },
          },
        ]),
      },
      dataCollectionRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "dcr-1",
            status: "success",
            startedAt: new Date("2026-06-30T06:02:38.000Z"),
            completedAt: new Date("2026-06-30T06:04:24.000Z"),
            extendedCounters: {
              agentId: "data-collection",
              searchProvider: "serper",
              searchCredits: 96,
              fetchByProvider: { jina: 204, playwright: 18 },
              relevanceModel: "gpt-4o-mini",
              relevancePromptTokens: 9_400,
              relevanceCompletionTokens: 1_120,
              relevanceTotalTokens: 10_520,
              stopReason: "daily_target_met",
            },
          },
          {
            id: "pcr-1",
            status: "success",
            startedAt: new Date("2026-06-30T06:01:10.000Z"),
            completedAt: new Date("2026-06-30T06:01:34.000Z"),
            extendedCounters: {
              agentId: "page-collection",
              fetchByProvider: { jina: 140 },
            },
          },
        ]),
      },
    });

    const result = await buildChronicle(NEWSLETTER, deps);

    const queryAnalysis = stageByName(result, "query-analysis");
    expect(queryAnalysis.kind).toBe("upstream");
    if (queryAnalysis.kind === "upstream") {
      expect(queryAnalysis.runCount).toBe(2);
      expect(queryAnalysis.totals.tokens.totalTokens).toBe(3_700);
      expect(queryAnalysis.totals.tokens.embeddingTokens).toBe(100);
    }

    const dataCollection = stageByName(result, "data-collection");
    if (dataCollection.kind === "upstream") {
      expect(dataCollection.runCount).toBe(1);
      expect(dataCollection.totals.searchCredits).toBe(96);
      expect(dataCollection.totals.fetchByProvider).toEqual({
        jina: 204,
        playwright: 18,
      });
      expect(dataCollection.runs[0]?.model).toBeNull();
      expect(dataCollection.runs[0]?.tokens).toBeNull();
    }

    const pageCollection = stageByName(result, "page-collection");
    if (pageCollection.kind === "upstream") {
      expect(pageCollection.runCount).toBe(1);
      expect(pageCollection.totals.fetchByProvider).toEqual({ jina: 140 });
      expect(pageCollection.totals.searchCredits).toBe(0);
    }

    expect(result.upstreamRunCount).toBe(4);
    expect(result.totalSearchCredits).toBe(96);
  });

  it("reads the grouped snapshot for saved/excluded and a separate page-collection run", async () => {
    const deps = makeDeps({
      dataCollectionRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "dcr-snap",
            status: "success",
            startedAt: new Date("2026-06-30T06:02:00.000Z"),
            completedAt: new Date("2026-06-30T06:04:00.000Z"),
            extendedCounters: { agentId: "data-collection" },
            snapshot: {
              agentId: "data-collection",
              cost: { searchCredits: 42, fetchByProvider: { firecrawl: 9 } },
              result: {
                saved: 9,
                excluded: 5,
                byReason: { existing: 3, freshness: 2 },
              },
              timing: {
                totalMs: 120000,
                roundsExecuted: 2,
                stopReason: "daily_target_met",
              },
            },
          },
        ]),
      },
      pageCollectionRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "pcr-snap",
            status: "success",
            startedAt: new Date("2026-06-30T06:01:00.000Z"),
            completedAt: new Date("2026-06-30T06:01:30.000Z"),
            snapshot: {
              agentId: "page-collection",
              cost: { searchCredits: 0, fetchByProvider: { firecrawl: 4 } },
              result: { saved: 4, excluded: 1, byReason: { existing: 1 } },
              timing: { totalMs: 30000, roundsExecuted: 1 },
            },
          },
        ]),
      },
    });

    const result = await buildChronicle(NEWSLETTER, deps);

    const dataCollection = stageByName(result, "data-collection");
    if (dataCollection.kind === "upstream") {
      expect(dataCollection.runCount).toBe(1);
      expect(dataCollection.totals.searchCredits).toBe(42);
      expect(dataCollection.details.saved).toBe(9);
      expect(dataCollection.details.excluded).toBe(5);
      expect(dataCollection.runs[0]?.tokens).toBeNull();
      expect(dataCollection.runs[0]?.outputs.collected).toBe(9);
    }

    const pageCollection = stageByName(result, "page-collection");
    if (pageCollection.kind === "upstream") {
      expect(pageCollection.runCount).toBe(1);
      expect(pageCollection.details.saved).toBe(4);
      expect(pageCollection.totals.fetchByProvider).toEqual({ firecrawl: 4 });
    }
  });

  it("surfaces self-driving query-analysis provider usage, credits, and discovery counts", async () => {
    const deps = makeDeps({
      searchQuerySet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "qs-sd-1",
            generatedAt: new Date("2026-06-30T06:00:00.000Z"),
            strategySnapshot: {
              agentVersion: "3.0.0",
              generationSource: "self_driving_v1",
              llmUsage: {
                model: "test-model",
                promptTokens: 120,
                completionTokens: 40,
                totalTokens: 160,
                calls: 1,
                cacheHit: false,
              },
              providerUsage: {
                searchProvider: [
                  { name: "serper", calls: 40 },
                  { name: "tavily", calls: 12 },
                ],
                searchCredits: 52,
              },
              discovered: {
                competitors: ["Bank Mandiri", "BCA"],
                regulators: ["OJK"],
              },
              probe: {
                candidates: 60,
                deduped: 48,
                droppedZeroYield: ["dead one", "dead two"],
                survivors: 30,
              },
              output: { queryCount: 24 },
              timing: { totalMs: 4_200 },
            },
          },
        ]),
      },
    });

    const result = await buildChronicle(NEWSLETTER, deps);

    const queryAnalysis = stageByName(result, "query-analysis");
    expect(queryAnalysis.kind).toBe("upstream");
    if (queryAnalysis.kind === "upstream") {
      expect(queryAnalysis.totals.searchCredits).toBe(52);
      const run = queryAnalysis.runs[0];
      expect(run?.providers).toEqual([
        { name: "serper", calls: 40 },
        { name: "tavily", calls: 12 },
      ]);
      expect(run?.durationMs).toBe(4_200);
      expect(run?.outputs).toMatchObject({
        queryCount: 24,
        cacheHit: false,
        searchCredits: 52,
        discoveredCompetitors: 2,
        discoveredRegulators: 1,
        droppedZeroYield: 2,
      });
    }
    expect(result.totalSearchCredits).toBe(52);
  });

  it("builds article-analysis runs with tokens from ArticleAnalysisRun rows", async () => {
    const deps = makeDeps({
      articleAnalysisRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "aar-1",
            status: "success",
            startedAt: new Date("2026-06-30T06:04:24.000Z"),
            completedAt: new Date("2026-06-30T06:05:02.000Z"),
            model: "gpt-4o-mini",
            promptTokens: 18_900,
            completionTokens: 3_400,
            totalTokens: 22_300,
            scored: 41,
            rejected: 48,
            backlog: 0,
            stopReason: "drained",
            durationMs: 38_000,
          },
        ]),
      },
    });

    const result = await buildChronicle(NEWSLETTER, deps);

    const articleAnalysis = stageByName(result, "article-analysis");
    expect(articleAnalysis.kind).toBe("upstream");
    if (articleAnalysis.kind === "upstream") {
      expect(articleAnalysis.runCount).toBe(1);
      expect(articleAnalysis.totals.tokens.totalTokens).toBe(22_300);
      expect(articleAnalysis.runs[0]?.model).toBe("gpt-4o-mini");
      expect(articleAnalysis.runs[0]?.outputs.stopReason).toBe("drained");
    }
    // Article-analysis tokens count toward the newsletter total.
    expect(result.totalTokens).toBe(17_250 + 22_300);
  });

  it("surfaces the per-rule matched/total breakdown in the classification sample", async () => {
    const deps = makeDeps({
      dataSourceTickerSection: {
        findMany: vi.fn().mockResolvedValue([
          {
            section: "industryPulse",
            sectionScore: 0.6,
            sectionReason: "Industry Pulse — matched 3/5.",
            sectionScoreBreakdown: {
              section: "industryPulse",
              matched: 3,
              total: 5,
              criteriaHash: "abc123def456",
              criteria: [],
              sections: [{ section: "industryPulse", matched: 3, total: 5 }],
            },
            analyzedAt: new Date("2026-06-30T06:04:00.000Z"),
            dataSource: { title: "Sector demand rebounds" },
          },
          {
            section: null,
            sectionScore: 0,
            sectionReason:
              "No inclusion rule matched in any section; rejected.",
            sectionScoreBreakdown: null,
            analyzedAt: new Date("2026-06-30T06:03:00.000Z"),
            dataSource: { title: "Unrelated filler" },
          },
        ]),
      },
    });

    const result = await buildChronicle(NEWSLETTER, deps);

    const articleAnalysis = stageByName(result, "article-analysis");
    if (articleAnalysis.kind !== "upstream") {
      throw new Error("expected an upstream article-analysis stage");
    }
    const sample = articleAnalysis.details.sample as Array<{
      matched: number | null;
      total: number | null;
      criteriaHash: string | null;
    }>;

    expect(sample[0]).toMatchObject({
      matched: 3,
      total: 5,
      criteriaHash: "abc123def456",
    });
    // Legacy rows without a persisted breakdown surface null tallies.
    expect(sample[1]).toMatchObject({
      matched: null,
      total: null,
      criteriaHash: null,
    });
  });

  it("surfaces a failed content-generation run and marks the pipeline failed", async () => {
    const deps = makeDeps({
      contentGenerationRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: "cgr-1",
          outcome: "failed",
          stage: "validate",
          errorCode: "validation_failed",
          errorCategory: "schema",
          message: "section 'Earnings' produced 0 bullets; minimum 1 required",
          durationMs: 2_100,
          createdAt: new Date("2026-06-30T06:05:04.000Z"),
          details: { sectionFill: { Earnings: 0, Macro: 3 } },
        }),
      },
    });

    const result = await buildChronicle(NEWSLETTER, deps);

    const contentGeneration = stageByName(result, "content-generation");
    expect(contentGeneration.status).toBe("failed");
    if (contentGeneration.kind === "downstream") {
      expect(contentGeneration.run?.error?.code).toBe("validation_failed");
      expect(contentGeneration.run?.error?.message).toContain("0 bullets");
    }
    expect(result.overallStatus).toBe("failed");
  });

  it("classifies delivery with failures as partial", async () => {
    const deps = makeDeps({
      deliveryRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "dr-1",
            outcome: "partial_success",
            stage: "send",
            successCount: 110,
            failureCount: 1,
            skippedCount: 1,
            durationMs: 15_000,
            runSkipReason: null,
            createdAt: new Date("2026-06-30T06:06:26.000Z"),
          },
        ]),
      },
    });

    const result = await buildChronicle(NEWSLETTER, deps);

    const delivery = stageByName(result, "delivery");
    expect(delivery.status).toBe("partial");
    if (delivery.kind === "downstream") {
      expect(delivery.run?.providers[0]).toEqual({
        name: "resend",
        calls: 110,
      });
    }
    expect(result.overallStatus).toBe("partial");
  });
});
