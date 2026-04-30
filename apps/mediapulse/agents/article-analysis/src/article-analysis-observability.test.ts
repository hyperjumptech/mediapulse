/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { ArticleRelevanceRow } from "./analysis-relevance-scoring.js";
import {
  ARTICLE_ANALYSIS_RUN_SUMMARY_MESSAGE,
  aggregateRelevanceObservability,
  buildArticleAnalysisRunSummaryPayload,
  scoreBucketFor,
  toSafeLogError,
} from "./article-analysis-observability.js";

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
      llmUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
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
});
