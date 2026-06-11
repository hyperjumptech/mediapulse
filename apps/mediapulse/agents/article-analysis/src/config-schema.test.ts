/** @vitest-environment node */

import { ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX } from "@workspace/agent-data-api-contract";
import { describe, expect, it } from "vitest";

import {
  buildDraftRelevanceRow,
  type PerSourceRelevanceSignals,
} from "./analysis-relevance-scoring.js";
import {
  articleAnalysisConfigSchema,
  toRelevanceWeightMapV1,
} from "./config-schema.js";

const minimalConfig = {
  credentials: { openaiApiKey: "sk-test" },
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
  it("rejects unknown keys under strict mode", () => {
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

  it("parses optional dynamics and batch fields", () => {
    const parsed = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      dynamics: {
        debounceMinUnanalyzedCount: 3,
        debounceMinMinutesSinceLastScore: 15,
      },
      batch: {
        maxSources: 20,
        getDataSourceLimitMax: 8,
      },
    });

    expect(parsed.dynamics.debounceMinUnanalyzedCount).toBe(3);
    expect(parsed.dynamics.debounceMinMinutesSinceLastScore).toBe(15);
    expect(parsed.batch.maxSources).toBe(20);
    expect(parsed.batch.getDataSourceLimitMax).toBe(8);
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

  it("fills schema defaults when Hermes omits optional groups", () => {
    const config = articleAnalysisConfigSchema.parse(minimalConfig);

    expect(config.dynamics.debounceMinUnanalyzedCount).toBe(0);
    expect(config.dynamics.debounceMinMinutesSinceLastScore).toBe(0);
    expect(config.batch.maxSources).toBe(10);
    expect(config.batch.getDataSourceLimitMax).toBe(
      ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX,
    );
    expect(config.extraction.useStructureAwareTruncation).toBe(false);
    expect(config.extraction.truncationLeadParagraphsAlwaysKept).toBe(2);
    expect(config.extraction.truncationFinancialKeywordsExtra).toEqual([]);
    expect(config.extraction.fewShotExemplarCount).toBe(0);
    expect(config.extraction.useBrainstormPass).toBe(false);
    expect(config.extraction.concurrency).toBe(1);
    expect(config.dynamics.runDeadlineMs).toBeUndefined();
    expect(config.quality.groundingPolicy).toBe("off");
    expect(config.quality.groundingMinTitleHits).toBe(0);
    expect(config.credentials.openaiModel).toBe("{{OPENAI_MODEL}}");
  });

  it("preserves Hermes dynamics and batch overrides", () => {
    const config = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      dynamics: {
        debounceMinUnanalyzedCount: 5,
        debounceMinMinutesSinceLastScore: 30,
      },
      batch: { maxSources: 12 },
    });

    expect(config.dynamics.debounceMinUnanalyzedCount).toBe(5);
    expect(config.dynamics.debounceMinMinutesSinceLastScore).toBe(30);
    expect(config.batch.maxSources).toBe(12);
  });

  it("preserves batch.getDataSourceLimitMax override from Hermes", () => {
    const config = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      batch: { getDataSourceLimitMax: 9 },
    });

    expect(config.batch.getDataSourceLimitMax).toBe(9);
  });

  it("rejects batch.getDataSourceLimitMax above API hard cap", () => {
    const result = articleAnalysisConfigSchema.safeParse({
      ...minimalConfig,
      batch: { getDataSourceLimitMax: ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX + 1 },
    });

    expect(result.success).toBe(false);
  });

  it("maps scoring.breakdownVersion to the version stored in POST breakdown", () => {
    const config = articleAnalysisConfigSchema.parse({
      ...minimalConfig,
      scoring: { breakdownVersion: 7 },
    });
    const row = buildDraftRelevanceRow(
      minimalSignals,
      config.scoring.breakdownVersion,
      toRelevanceWeightMapV1(config),
    );

    expect(config.scoring.breakdownVersion).toBe(7);
    expect(row.scoreBreakdown._version).toBe(7);
  });

  it("uses default breakdownVersion when Hermes omits scoring", () => {
    const config = articleAnalysisConfigSchema.parse(minimalConfig);

    expect(config.scoring.breakdownVersion).toBe(1);
  });
});
