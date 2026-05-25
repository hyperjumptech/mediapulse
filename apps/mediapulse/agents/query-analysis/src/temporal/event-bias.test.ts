/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

import { DEFAULT_EVENT_BIAS_RULES } from "./default-rules";
import {
  applyEventBiasToIntentWeights,
  computeEventBias,
  daysUntilEarnings,
  hasRecentMergerDelta,
  hasRecentRegulatoryEvent,
  mergeEventBiasMultipliers,
} from "./event-bias";
import { DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS } from "@workspace/agent-data-api-contract";

const FIXED_NOW = new Date("2026-05-21T12:00:00.000Z");
const FIXED_CLOCK = (): Date => FIXED_NOW;

const baseContext: GetQueryAnalysisResponse = {
  ticker: {
    id: "11111111-1111-4111-a111-111111111111",
    symbol: "ACME",
    name: "Acme Co",
    metadata: null,
  },
  topEntities: [],
  recentThemes: [],
  peers: [],
  calendar: { recentEventTypes: [] },
  headlineSamples: [],
  kgNeighborhood: [],
};

describe("daysUntilEarnings", () => {
  it("returns undefined when next earnings is absent", () => {
    expect(daysUntilEarnings(baseContext, FIXED_CLOCK)).toBeUndefined();
  });

  it("returns whole days until the next earnings date", () => {
    const context: GetQueryAnalysisResponse = {
      ...baseContext,
      calendar: {
        recentEventTypes: [],
        nextEarningsAt: "2026-05-28T12:00:00.000Z",
      },
    };

    expect(daysUntilEarnings(context, FIXED_CLOCK)).toBe(7);
  });
});

describe("hasRecentMergerDelta", () => {
  it("detects merger-style relation deltas", () => {
    const context: GetQueryAnalysisResponse = {
      ...baseContext,
      recentRelationDeltas: [
        {
          fromEntity: "Acme",
          toEntity: "Target Co",
          relationType: "merger",
          change: "added",
        },
      ],
    };

    expect(hasRecentMergerDelta(context)).toBe(true);
  });
});

describe("hasRecentRegulatoryEvent", () => {
  it("detects regulatory calendar event types", () => {
    const context: GetQueryAnalysisResponse = {
      ...baseContext,
      calendar: { recentEventTypes: ["regulatory_filing"] },
    };

    expect(hasRecentRegulatoryEvent(context)).toBe(true);
  });
});

describe("mergeEventBiasMultipliers", () => {
  it("multiplies overlapping intents across rules", () => {
    const merged = mergeEventBiasMultipliers(
      { regulatory: 2 },
      { regulatory: 1.5, macro: 1.3 },
    );

    expect(merged).toEqual({ regulatory: 3, macro: 1.3 });
  });
});

describe("computeEventBias", () => {
  it("does not boost earnings-related intents when earnings are near", () => {
    const context: GetQueryAnalysisResponse = {
      ...baseContext,
      calendar: {
        recentEventTypes: [],
        nextEarningsAt: "2026-05-28T12:00:00.000Z",
      },
    };

    const result = computeEventBias(
      context,
      FIXED_CLOCK,
      DEFAULT_EVENT_BIAS_RULES,
    );

    expect(result.firedRuleIds).not.toContain("near-earnings");
    expect(result.multipliers.fundamental).toBeUndefined();
  });

  it("boosts regulatory intent when recent regulatory events are present", () => {
    const context: GetQueryAnalysisResponse = {
      ...baseContext,
      calendar: { recentEventTypes: ["regulatory_filing"] },
    };

    const result = computeEventBias(
      context,
      FIXED_CLOCK,
      DEFAULT_EVENT_BIAS_RULES,
    );

    expect(result.firedRuleIds).toContain("recent-regulatory-event");
    expect(result.multipliers.regulatory).toBe(1.5);
    expect(result.multipliers.macro).toBe(1.3);
  });

  it("fires merger boost regardless of earnings timing", () => {
    const context: GetQueryAnalysisResponse = {
      ...baseContext,
      calendar: {
        recentEventTypes: [],
        nextEarningsAt: "2026-08-01T12:00:00.000Z",
      },
      recentRelationDeltas: [
        {
          fromEntity: "Acme",
          toEntity: "Rival",
          relationType: "acquisition",
          change: "added",
        },
      ],
    };

    const result = computeEventBias(
      context,
      FIXED_CLOCK,
      DEFAULT_EVENT_BIAS_RULES,
    );

    expect(result.firedRuleIds).toContain("recent-merger-delta");
    expect(result.multipliers.kg_change).toBe(2);
    expect(result.multipliers.competitor).toBe(1.5);
  });
});

describe("applyEventBiasToIntentWeights", () => {
  it("multiplies only intents present in the bias map", () => {
    const adjusted = applyEventBiasToIntentWeights(
      DEFAULT_QUERY_ANALYSIS_INTENT_WEIGHTS,
      { regulatory: 1.5, macro: 1.3 },
    );

    expect(adjusted.regulatory).toBeCloseTo(0.6 * 1.5);
    expect(adjusted.macro).toBeCloseTo(0.7 * 1.3);
    expect(adjusted.breaking).toBe(1);
  });
});
