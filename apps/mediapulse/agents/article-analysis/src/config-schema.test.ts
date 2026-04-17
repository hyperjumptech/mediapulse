/** @vitest-environment node */

import { describe, expect, it } from "vitest";

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
  url: "https://reuters.com/article",
  entityCount: 1,
  relationCount: 1,
  mentionCount: 1,
  avgMentionConfidence: 0.5,
  titleLower: "headline",
  textLower: "body",
} satisfies PerSourceRelevanceSignals;

describe("articleAnalysisConfigSchema", () => {
  it("parses optional debounce and default batch fields", () => {
    // Act
    const parsed = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      debounceMinUnanalyzedCount: 3,
      debounceMinMinutesSinceLastScore: 15,
      defaultMaxBatchSize: 20,
    });

    // Assert
    expect(parsed.debounceMinUnanalyzedCount).toBe(3);
    expect(parsed.debounceMinMinutesSinceLastScore).toBe(15);
    expect(parsed.defaultMaxBatchSize).toBe(20);
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
  });

  it("preserves Hermes debounce and defaultMaxBatchSize overrides", () => {
    // Act
    const resolved = resolveArticleAnalysisConfig(
      articleAnalysisConfigSchema.parse({
        ...minimalConfig,
        debounceMinUnanalyzedCount: 5,
        debounceMinMinutesSinceLastScore: 30,
        defaultMaxBatchSize: 12,
      }),
    );

    // Assert
    expect(resolved.debounceMinUnanalyzedCount).toBe(5);
    expect(resolved.debounceMinMinutesSinceLastScore).toBe(30);
    expect(resolved.defaultMaxBatchSize).toBe(12);
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
