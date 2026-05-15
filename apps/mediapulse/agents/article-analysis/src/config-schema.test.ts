/** @vitest-environment node */

import { ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX } from "@workspace/agent-data-api-contract";
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
import { ARTICLE_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH } from "./article-extraction-prompt-defaults.js";

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
} satisfies PerSourceRelevanceSignals;

describe("articleAnalysisConfigSchema", () => {
  it("rejects unknown placeholder in prompts.userPromptTemplate", () => {
    const result = articleAnalysisConfigSchema.safeParse({
      ...minimalConfig,
      prompts: {
        userPromptTemplate: "{{tickerId}} {{oops}}",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toContain("{{oops}}");
    }
  });

  it("rejects unknown placeholder in prompts.systemPrompt", () => {
    const result = articleAnalysisConfigSchema.safeParse({
      ...minimalConfig,
      prompts: {
        systemPrompt: "Hello {{entityTypesBlock}} {{typo}}",
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toContain("{{typo}}");
    }
  });

  it("rejects prompts.systemPrompt over max length", () => {
    const result = articleAnalysisConfigSchema.safeParse({
      ...minimalConfig,
      prompts: {
        systemPrompt: "x".repeat(ARTICLE_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH + 1),
      },
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid prompts with known placeholders only", () => {
    const parsed = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      prompts: {
        systemPrompt: "Types:\n{{entityTypesBlock}}\nRels:\n{{relationTypesBlock}}",
        userPromptTemplate: "{{tickerId}}\n{{title}}\n{{articleContent}}",
      },
    });

    expect(parsed.prompts?.systemPrompt).toContain("{{entityTypesBlock}}");
    expect(parsed.prompts?.userPromptTemplate).toContain("{{tickerId}}");
  });

  it("parses optional debounce and default batch fields", () => {
    // Act
    const parsed = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      debounceMinUnanalyzedCount: 3,
      debounceMinMinutesSinceLastScore: 15,
      defaultMaxBatchSize: 20,
      analysisGetDataSourceLimitMax: 8,
    });

    // Assert
    expect(parsed.debounceMinUnanalyzedCount).toBe(3);
    expect(parsed.debounceMinMinutesSinceLastScore).toBe(15);
    expect(parsed.defaultMaxBatchSize).toBe(20);
    expect(parsed.analysisGetDataSourceLimitMax).toBe(8);
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
    expect(resolved.defaultMaxBatchSize).toBe(
      articleAnalysisConfigDefaults.defaultMaxBatchSize,
    );
    expect(resolved.analysisGetDataSourceLimitMax).toBe(
      articleAnalysisConfigDefaults.analysisGetDataSourceLimitMax,
    );
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
