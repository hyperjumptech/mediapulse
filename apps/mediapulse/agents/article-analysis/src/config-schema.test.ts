/** @vitest-environment node */

import { ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX } from "@workspace/agent-data-api-contract";
import { describe, expect, it } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  buildDraftRelevanceRow,
  type PerSourceRelevanceSignals,
} from "./analysis-relevance-scoring.js";
import {
  articleAnalysisConfigSchema,
  articleAnalysisConfigDefaults,
  resolveArticleAnalysisConfig,
  toRelevanceWeightMapV1,
} from "./config-schema.js";

const minimalConfig = {
  openaiApiKey: "sk-test",
} satisfies Parameters<typeof articleAnalysisConfigSchema.parse>[0];

const minimalSignals = {
  dataSourceId: "00000000-0000-4000-8000-000000000001",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  entityCount: 1,
  relationCount: 1,
  mentionCount: 1,
  avgMentionConfidence: 0.5,
  titleLower: "headline",
  textLower: "body",
  entityNames: [],
} satisfies PerSourceRelevanceSignals;

describe("articleAnalysisConfigSchema", () => {
  it("rejects prompts block under strict mode", () => {
    const result = articleAnalysisConfigSchema.safeParse({
      ...minimalConfig,
      prompts: {
        systemPrompt: "x",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/unrecognized/i);
    }
  });

  it("parses optional debounce and batch fields", () => {
    // Act
    const parsed = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      debounceMinUnanalyzedCount: 3,
      debounceMinMinutesSinceLastScore: 15,
      maxBatchSize: 20,
      analysisGetDataSourceLimitMax: 8,
    });

    // Assert
    expect(parsed.debounceMinUnanalyzedCount).toBe(3);
    expect(parsed.debounceMinMinutesSinceLastScore).toBe(15);
    expect(parsed.maxBatchSize).toBe(20);
    expect(parsed.analysisGetDataSourceLimitMax).toBe(8);
  });

  it("rejects legacy defaultMaxBatchSize key under strict mode", () => {
    const result = articleAnalysisConfigSchema.safeParse({
      ...minimalConfig,
      defaultMaxBatchSize: 10,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/unrecognized/i);
    }
  });
});

describe("resolveArticleAnalysisConfig", () => {
  it("fills debounce defaults of zero when Hermes omits them", () => {
    // Act
    const resolved = resolveArticleAnalysisConfig(
      articleAnalysisConfigSchema.parse(minimalConfig),
    );

    // Assert
    expect(resolved.debounceMinUnanalyzedCount).toBe(0);
    expect(resolved.debounceMinMinutesSinceLastScore).toBe(0);
    expect(resolved.maxBatchSize).toBe(
      articleAnalysisConfigDefaults.maxBatchSize,
    );
    expect(resolved.analysisGetDataSourceLimitMax).toBe(
      articleAnalysisConfigDefaults.analysisGetDataSourceLimitMax,
    );
    expect(resolved.useStructureAwareTruncation).toBe(false);
    expect(resolved.truncationLeadParagraphsAlwaysKept).toBe(2);
    expect(resolved.truncationFinancialKeywordsExtra).toEqual([]);
    expect(resolved.fewShotExemplarCount).toBe(0);
    expect(resolved.useBrainstormPass).toBe(false);
    expect(resolved.brainstormModel).toBe(
      articleAnalysisConfigDefaults.openaiModel,
    );
    expect(resolved.extractionConcurrency).toBe(1);
    expect(resolved.runDeadlineMs).toBeUndefined();
    expect(resolved.entityGroundingPolicy).toBe("off");
    expect(resolved.entityGroundingMinTitleHits).toBe(0);
  });

  it("preserves Hermes debounce and maxBatchSize overrides", () => {
    // Act
    const resolved = resolveArticleAnalysisConfig(
      articleAnalysisConfigSchema.parse({
        ...minimalConfig,
        debounceMinUnanalyzedCount: 5,
        debounceMinMinutesSinceLastScore: 30,
        maxBatchSize: 12,
      }),
    );

    // Assert
    expect(resolved.debounceMinUnanalyzedCount).toBe(5);
    expect(resolved.debounceMinMinutesSinceLastScore).toBe(30);
    expect(resolved.maxBatchSize).toBe(12);
  });

  it("preserves analysisGetDataSourceLimitMax override from Hermes", () => {
    const resolved = resolveArticleAnalysisConfig(
      articleAnalysisConfigSchema.parse({
        ...minimalConfig,
        analysisGetDataSourceLimitMax: 9,
      }),
    );

    expect(resolved.analysisGetDataSourceLimitMax).toBe(9);
  });

  it("rejects analysisGetDataSourceLimitMax above API hard cap", () => {
    const result = articleAnalysisConfigSchema.safeParse({
      ...minimalConfig,
      analysisGetDataSourceLimitMax: ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX + 1,
    });

    expect(result.success).toBe(false);
  });

  it("maps scoreBreakdownVersion to resolved config used for POST breakdown", () => {
    // Act
    const resolved = resolveArticleAnalysisConfig(
      articleAnalysisConfigSchema.parse({
        ...minimalConfig,
        scoreBreakdownVersion: 7,
      }),
    );
    const row = buildDraftRelevanceRow(
      minimalSignals,
      resolved.scoreBreakdownVersion,
      toRelevanceWeightMapV1(resolved),
    );

    // Assert
    expect(resolved.scoreBreakdownVersion).toBe(7);
    expect(row.scoreBreakdown._version).toBe(7);
  });

  it("uses package default scoreBreakdownVersion when Hermes omits it", () => {
    // Act
    const resolved = resolveArticleAnalysisConfig(
      articleAnalysisConfigSchema.parse(minimalConfig),
    );

    // Assert
    expect(resolved.scoreBreakdownVersion).toBe(
      articleAnalysisConfigDefaults.scoreBreakdownVersion,
    );
  });
});
