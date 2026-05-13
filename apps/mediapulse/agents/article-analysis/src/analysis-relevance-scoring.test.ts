/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildDraftRelevanceRow,
  buildScoreBreakdownV1,
  clampUnitInterval,
  computeWeightedScore,
  RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1,
  validateRelevanceRowForPost,
  type PerSourceRelevanceSignals,
} from "./analysis-relevance-scoring.js";

const WEIGHTS = {
  breakingNews: 0.2,
  kgRelation: 0.2,
  fundamental: 0.2,
  tickerSalience: 0.2,
  sourceQuality: 0.2,
} as const;

const baseSignals = (): PerSourceRelevanceSignals => ({
  dataSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  createdAt: new Date("2026-04-09T12:00:00Z"),
  entityCount: 2,
  relationCount: 1,
  mentionCount: 2,
  avgMentionConfidence: 0.8,
  titleLower: "company reports earnings",
  textLower: "revenue grew year over year",
});

describe("clampUnitInterval", () => {
  it("clamps to zero one", () => {
    expect(clampUnitInterval(-1)).toBe(0);
    expect(clampUnitInterval(2)).toBe(1);
    expect(clampUnitInterval(0.5)).toBe(0.5);
  });
});

describe("buildScoreBreakdownV1", () => {
  it("includes five canonical keys and _version", () => {
    const b = buildScoreBreakdownV1(baseSignals(), 1);
    expect(b._version).toBe(1);
    for (const k of RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1) {
      expect(typeof b[k]).toBe("number");
      expect(b[k]).toBeGreaterThanOrEqual(0);
      expect(b[k]).toBeLessThanOrEqual(1);
    }
  });
});

describe("computeWeightedScore", () => {
  it("weights canonical keys only", () => {
    const b = buildScoreBreakdownV1(baseSignals(), 1);
    const s = computeWeightedScore(b, WEIGHTS);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
  });
});

describe("validateRelevanceRowForPost", () => {
  it("accepts a draft row from buildDraftRelevanceRow", () => {
    const row = buildDraftRelevanceRow(baseSignals(), 1, WEIGHTS);
    expect(validateRelevanceRowForPost(row, WEIGHTS)).toBeNull();
  });

  it("rejects score drift", () => {
    const row = buildDraftRelevanceRow(baseSignals(), 1, WEIGHTS);
    const bad = { ...row, score: 0.01 };
    expect(validateRelevanceRowForPost(bad, WEIGHTS)).not.toBeNull();
  });

  it("rejects non-integer scoreBreakdown _version", () => {
    const row = buildDraftRelevanceRow(baseSignals(), 1, WEIGHTS);
    const bad = {
      ...row,
      scoreBreakdown: {
        ...row.scoreBreakdown,
        _version: 1.5,
      },
    };
    expect(validateRelevanceRowForPost(bad, WEIGHTS)).toContain("integer >= 1");
  });
});
