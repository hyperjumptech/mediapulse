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
  dataSourceTickerSection: { findMany: vi.fn().mockResolvedValue([]) },
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
      expect(dataCollection.runs[0]?.model).toBe("gpt-4o-mini");
      expect(dataCollection.runs[0]?.tokens?.totalTokens).toBe(10_520);
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
