/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { ArticleRelevanceRow } from "./analysis-relevance-scoring.js";
import {
  ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
  ARTICLE_ANALYSIS_YIELD_SNAPSHOT_MESSAGE,
  aggregateRelevanceObservability,
  buildArticleAnalysisRunSummaryPayload,
  buildYieldSnapshot,
  compareYieldAgainstBaseline,
  percentileOf,
  scoreBucketFor,
  toSafeLogError,
} from "./article-analysis-observability.js";
import { createEmptyQualityCounters } from "./utilities/content-quality-gate.js";

describe("toSafeLogError", () => {
  it("returns name and message for Error", () => {
    const err = new TypeError("boom");
    expect(toSafeLogError(err)).toEqual({
      type: "TypeError",
      message: "boom",
    });
  });

  it("stringifies non-Error values", () => {
    expect(toSafeLogError("x")).toEqual({ type: "string", message: "x" });
    expect(toSafeLogError(42)).toEqual({ type: "number", message: "42" });
    expect(toSafeLogError(null)).toEqual({ type: "object", message: "null" });
  });
});

describe("scoreBucketFor", () => {
  it("maps boundary scores into half-open buckets", () => {
    expect(scoreBucketFor(0)).toBe("0_0.2");
    expect(scoreBucketFor(0.199)).toBe("0_0.2");
    expect(scoreBucketFor(0.2)).toBe("0.2_0.4");
    expect(scoreBucketFor(0.8)).toBe("0.8_1");
    expect(scoreBucketFor(1)).toBe("0.8_1");
  });
});

describe("aggregateRelevanceObservability", () => {
  const row = (
    score: number,
    breakdown: ArticleRelevanceRow["scoreBreakdown"],
  ): ArticleRelevanceRow => ({
    dataSourceId: "ds",
    score,
    scoreBreakdown: breakdown,
    selected: false,
  });

  it("returns zeroed stats for empty rows", () => {
    const a = aggregateRelevanceObservability([]);
    expect(a.rowCount).toBe(0);
    expect(a.scoreMean).toBe(0);
    expect(a.scoreBuckets["0_0.2"]).toBe(0);
    expect(a.breakdownVersion).toBe(0);
    expect(a.breakdownKeyMeans.breakingNews).toBe(0);
  });

  it("aggregates scores and breakdown keys", () => {
    const a = aggregateRelevanceObservability([
      row(0.1, {
        _version: 1,
        breakingNews: 0,
        kgRelation: 0.5,
        fundamental: 0.5,
        tickerSalience: 0.5,
        sourceQuality: 0.5,
      }),
      row(0.9, {
        _version: 1,
        breakingNews: 1,
        kgRelation: 0.5,
        fundamental: 0.5,
        tickerSalience: 0.5,
        sourceQuality: 0.5,
      }),
    ]);
    expect(a.rowCount).toBe(2);
    expect(a.scoreMin).toBe(0.1);
    expect(a.scoreMax).toBe(0.9);
    expect(a.scoreMean).toBe(0.5);
    expect(a.scoreBuckets["0_0.2"]).toBe(1);
    expect(a.scoreBuckets["0.8_1"]).toBe(1);
    expect(a.breakdownVersion).toBe(1);
    expect(a.breakdownKeyMeans.breakingNews).toBe(0.5);
    expect(a.breakdownKeyMins.breakingNews).toBe(0);
    expect(a.breakdownKeyMaxs.breakingNews).toBe(1);
  });

  it("marks mixed breakdown versions", () => {
    const a = aggregateRelevanceObservability([
      row(0.5, {
        _version: 1,
        breakingNews: 0.5,
        kgRelation: 0.5,
        fundamental: 0.5,
        tickerSalience: 0.5,
        sourceQuality: 0.5,
      }),
      row(0.5, {
        _version: 2,
        breakingNews: 0.5,
        kgRelation: 0.5,
        fundamental: 0.5,
        tickerSalience: 0.5,
        sourceQuality: 0.5,
      }),
    ]);
    expect(a.breakdownVersion).toBe("mixed");
  });
});

describe("buildArticleAnalysisRunSummaryPayload", () => {
  it("includes extraction and POST failure tallies", () => {
    const payload = buildArticleAnalysisRunSummaryPayload({
      outcome: "success",
      articlesProcessed: 3,
      extractionSuccessCount: 2,
      extractionFailures: [
        {
          dataSourceId: "a",
          stage: "vocabulary",
          message: "bad",
        },
        { dataSourceId: "b", stage: "llm", message: "timeout" },
      ],
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 1,
        articleEntityChunkParseErrors: 2,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [
        {
          chunkKind: "entities_relations",
          chunkIndex: 0,
          errorCategory: "agent_data_api_http",
          httpStatus: 500,
          message: "Agent data API error: 500",
        },
        {
          chunkKind: "article_relevances",
          chunkIndex: 1,
          errorCategory: "unknown",
          message: "x",
        },
      ],
      entitiesCreated: 2,
      entitiesReused: 2,
      relationsCreated: 3,
      articlesScored: 2,
      articlesSelected: 1,
      relevanceAggregate: null,
      llmUsage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        brainstormCalls: 1,
        brainstormPromptTokens: 5,
        brainstormCompletionTokens: 7,
        critiqueCalls: 0,
        critiquePromptTokens: 0,
        critiqueCompletionTokens: 0,
      },
      extractionLatencyMsTotal: 300,
      extractionCalls: 2,
      runStatusLabel: "partial_success",
    });

    expect(payload.event).toBe(ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE);
    expect(payload.extractionFailuresVocabulary).toBe(1);
    expect(payload.extractionFailuresLlm).toBe(1);
    expect(payload.extractionFailuresPrefilter).toBe(0);
    expect(payload.scoreFailureCount).toBe(1);
    expect(payload.chunkParseErrorsEntityRelation).toBe(1);
    expect(payload.chunkParseErrorsArticleEntity).toBe(2);
    expect(payload.postFailuresByChunkKind).toEqual({
      entities_relations: 1,
      article_entities: 0,
      article_relevances: 1,
    });
    expect(payload.postFailuresByErrorCategory).toEqual({
      agent_data_api_http: 1,
      unknown: 1,
    });
    expect(payload.entityReuseRatio).toBe(0.5);
    expect(payload.avgExtractionLatencyMs).toBe(150);
    expect(payload.llmTotalTokens).toBe(30);
    expect(payload.llmBrainstormCalls).toBe(1);
    expect(payload.llmBrainstormPromptTokens).toBe(5);
    expect(payload.llmBrainstormCompletionTokens).toBe(7);
    expect(payload.schemaValidationFailureCount).toBe(3);
    expect(payload.failureCountsByKind).toEqual({
      llm: 1,
      vocabulary: 1,
      prefilter: 0,
      schemaValidation: 3,
      persistenceHttp: 1,
      persistenceOther: 1,
    });
    expect(payload.stageMetrics).toEqual({
      extract: {
        articlesProcessed: 3,
        articlesSucceeded: 2,
        articlesFailedExtraction: 2,
      },
      scorePrepare: { schemaValidationFailures: 3 },
      persist: {
        postChunkFailures: 2,
        articlesScored: 2,
        articlesSelected: 1,
      },
    });
  });

  it("includes llmPromptFingerprint when provided", () => {
    const payload = buildArticleAnalysisRunSummaryPayload({
      outcome: "success",
      articlesProcessed: 1,
      extractionSuccessCount: 1,
      extractionFailures: [],
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 0,
        articleEntityChunkParseErrors: 0,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [],
      entitiesCreated: 0,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
      relevanceAggregate: null,
      llmUsage: null,
      extractionLatencyMsTotal: 0,
      extractionCalls: 1,
      llmPromptFingerprint: "a1b2c3d4e5f6a7b8",
    });

    expect(payload.llmPromptFingerprint).toBe("a1b2c3d4e5f6a7b8");
  });

  it("omits LLM usage keys when usage is null", () => {
    const payload = buildArticleAnalysisRunSummaryPayload({
      outcome: "success",
      articlesProcessed: 1,
      extractionSuccessCount: 1,
      extractionFailures: [],
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 0,
        articleEntityChunkParseErrors: 0,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [],
      entitiesCreated: 0,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
      relevanceAggregate: null,
      llmUsage: null,
      extractionLatencyMsTotal: 0,
      extractionCalls: 0,
    });
    expect("llmTotalTokens" in payload).toBe(false);
    expect(payload.scoreFailureCount).toBe(0);
    expect(payload.schemaValidationFailureCount).toBe(0);
    expect(payload.failureCountsByKind).toEqual({
      llm: 0,
      vocabulary: 0,
      prefilter: 0,
      schemaValidation: 0,
      persistenceHttp: 0,
      persistenceOther: 0,
    });
    expect(payload.stageMetrics).toEqual({
      extract: {
        articlesProcessed: 1,
        articlesSucceeded: 1,
        articlesFailedExtraction: 0,
      },
      scorePrepare: { schemaValidationFailures: 0 },
      persist: {
        postChunkFailures: 0,
        articlesScored: 0,
        articlesSelected: 0,
      },
    });
  });

  it("embeds failure reason and safe error for top-level failures", () => {
    const payload = buildArticleAnalysisRunSummaryPayload({
      outcome: "failure",
      articlesProcessed: 0,
      extractionSuccessCount: 0,
      extractionFailures: [],
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 0,
        articleEntityChunkParseErrors: 0,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [],
      entitiesCreated: 0,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
      relevanceAggregate: null,
      llmUsage: null,
      extractionLatencyMsTotal: 0,
      extractionCalls: 0,
      semanticFailureReason: "empty vocabulary",
      topLevelError: { type: "Error", message: "network" },
    });
    expect(payload.semanticFailureReason).toBe("empty vocabulary");
    expect(payload.error).toEqual({ type: "Error", message: "network" });
  });

  it("includes droppedByContentQuality when provided", () => {
    const payload = buildArticleAnalysisRunSummaryPayload({
      outcome: "success",
      articlesProcessed: 4,
      extractionSuccessCount: 1,
      extractionFailures: [],
      droppedByContentQuality: {
        prefilter_blocked_host: 0,
        prefilter_blocked_path: 0,
        prefilter_index_title: 0,
        content_no_title: 0,
        content_soft_404: 1,
        content_access_gated: 1,
        content_too_short: 1,
        content_repetitive: 0,
      },
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 0,
        articleEntityChunkParseErrors: 0,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [],
      entitiesCreated: 0,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
      relevanceAggregate: null,
      llmUsage: null,
      extractionLatencyMsTotal: 0,
      extractionCalls: 1,
    });

    expect(payload.droppedByContentQuality).toEqual({
      prefilter_blocked_host: 0,
      prefilter_blocked_path: 0,
      prefilter_index_title: 0,
      content_no_title: 0,
      content_soft_404: 1,
      content_access_gated: 1,
      content_too_short: 1,
      content_repetitive: 0,
    });
  });

  it("includes truncation aggregates when provided", () => {
    const payload = buildArticleAnalysisRunSummaryPayload({
      outcome: "success",
      articlesProcessed: 1,
      extractionSuccessCount: 1,
      extractionFailures: [],
      truncation: {
        leadCharsKept: 120,
        tickerSentencesKept: 1,
        paragraphsKept: 4,
        paragraphsDropped: 2,
      },
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 0,
        articleEntityChunkParseErrors: 0,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [],
      entitiesCreated: 0,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
      relevanceAggregate: null,
      llmUsage: null,
      extractionLatencyMsTotal: 0,
      extractionCalls: 1,
    });

    expect(payload.truncation).toEqual({
      leadCharsKept: 120,
      tickerSentencesKept: 1,
      paragraphsKept: 4,
      paragraphsDropped: 2,
    });
  });

  it("includes exemplars counters when provided", () => {
    const payload = buildArticleAnalysisRunSummaryPayload({
      outcome: "success",
      articlesProcessed: 1,
      extractionSuccessCount: 1,
      extractionFailures: [],
      exemplars: {
        requestedCount: 4,
        resolvedCount: 2,
        appliedArchetypes: ["earnings", "leadership"],
      },
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 0,
        articleEntityChunkParseErrors: 0,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [],
      entitiesCreated: 0,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 0,
      articlesSelected: 0,
      relevanceAggregate: null,
      llmUsage: null,
      extractionLatencyMsTotal: 0,
      extractionCalls: 1,
    });

    expect(payload.exemplarsRequestedCount).toBe(4);
    expect(payload.exemplarsResolvedCount).toBe(2);
    expect(payload.exemplarsApplied).toEqual(["earnings", "leadership"]);
  });
});

describe("percentileOf", () => {
  it("returns null for an empty sample", () => {
    expect(percentileOf([], 0.5)).toBeNull();
  });

  it("returns the median for an odd-length sample", () => {
    expect(percentileOf([100, 200, 300], 0.5)).toBe(200);
  });
});

describe("buildYieldSnapshot", () => {
  it("derives pass counts and extraction yield from run summary counters", () => {
    const droppedByContentQuality = createEmptyQualityCounters();
    droppedByContentQuality.content_soft_404 = 1;
    droppedByContentQuality.content_too_short = 1;

    const snapshot = buildYieldSnapshot({
      outcome: "success",
      articlesProcessed: 10,
      extractionSuccessCount: 6,
      extractionFailures: [
        {
          dataSourceId: "vocab",
          stage: "vocabulary",
          message: "bad type",
        },
      ],
      droppedByContentQuality,
      grounding: {
        entitiesUngroundedTotal: 1,
        relationsDroppedTotal: 0,
        mentionsDroppedTotal: 0,
      },
      vocabularyPartitioning: {
        badEntitiesDropped: 1,
        badRelationsDropped: 0,
        repairCallsAttempted: 0,
        repairCallsSucceeded: 0,
        repairCallsFailed: 0,
        rowsRecoveredByRepair: 0,
      },
      relevanceRowValidationFailures: 0,
      chunkParseCounts: {
        entityRelationChunkParseErrors: 0,
        articleEntityChunkParseErrors: 0,
        articleRelevanceChunkParseErrors: 0,
      },
      postFailures: [],
      entitiesCreated: 6,
      entitiesReused: 0,
      relationsCreated: 0,
      articlesScored: 6,
      articlesSelected: 2,
      relevanceAggregate: null,
      llmUsage: null,
      extractionLatencyMsTotal: 600,
      extractionCalls: 6,
      perSourceLatency: {
        extractionMs: [100, 200, 300, 400, 500, 600],
        brainstormMs: [50],
        critiqueMs: [75],
      },
    });

    expect(snapshot.batchSize).toBe(10);
    expect(snapshot.passed.qualityGate).toBe(8);
    expect(snapshot.passed.grounding).toBe(7);
    expect(snapshot.passed.vocabulary).toBe(6);
    expect(snapshot.ratios.extractionYield).toBe(0.6);
    expect(snapshot.dropped.byGrounding.entities).toBe(1);
    expect(snapshot.dropped.byVocabulary.entities).toBe(1);
    expect(snapshot.latency.extractionMsP50).toBe(300);
    expect(snapshot.latency.brainstormMsP50).toBe(50);
    expect(snapshot.latency.critiqueMsP50).toBe(75);
  });
});

describe("compareYieldAgainstBaseline", () => {
  it("flags regression when a ratio drops more than 15 points below baseline", () => {
    const comparison = compareYieldAgainstBaseline(
      buildYieldSnapshot({
        outcome: "success",
        articlesProcessed: 10,
        extractionSuccessCount: 6,
        extractionFailures: [],
        relevanceRowValidationFailures: 0,
        chunkParseCounts: {
          entityRelationChunkParseErrors: 0,
          articleEntityChunkParseErrors: 0,
          articleRelevanceChunkParseErrors: 0,
        },
        postFailures: [],
        entitiesCreated: 6,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 6,
        articlesSelected: 2,
        relevanceAggregate: null,
        llmUsage: null,
        extractionLatencyMsTotal: 0,
        extractionCalls: 6,
      }),
      { extractionYieldP50: 0.8 },
    );

    expect(comparison.regression).toBe(true);
    expect(comparison.deltas?.extractionYieldDelta).toBeCloseTo(-0.2);
  });

  it("returns no regression when baseline is unset", () => {
    const comparison = compareYieldAgainstBaseline(
      buildYieldSnapshot({
        outcome: "success",
        articlesProcessed: 1,
        extractionSuccessCount: 1,
        extractionFailures: [],
        relevanceRowValidationFailures: 0,
        chunkParseCounts: {
          entityRelationChunkParseErrors: 0,
          articleEntityChunkParseErrors: 0,
          articleRelevanceChunkParseErrors: 0,
        },
        postFailures: [],
        entitiesCreated: 1,
        entitiesReused: 0,
        relationsCreated: 0,
        articlesScored: 1,
        articlesSelected: 1,
        relevanceAggregate: null,
        llmUsage: null,
        extractionLatencyMsTotal: 0,
        extractionCalls: 1,
      }),
      undefined,
    );

    expect(comparison.regression).toBe(false);
    expect(comparison.baseline).toBe("unset");
    expect(comparison.deltas).toBeNull();
  });
});
