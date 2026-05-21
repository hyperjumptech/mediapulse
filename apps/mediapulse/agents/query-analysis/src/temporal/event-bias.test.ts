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
      { fundamental: 2 },
      { fundamental: 1.5, sentiment: 1.5 },
    );

    expect(merged).toEqual({ fundamental: 3, sentiment: 1.5 });
  });
});

describe("computeEventBias", () => {
  it("fires the near-earnings rule when earnings are within 14 days", () => {
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

    expect(result.firedRuleIds).toContain("near-earnings");
    expect(result.multipliers.fundamental).toBe(2);
    expect(result.multipliers.sentiment).toBe(1.5);
  });

  it("does not fire near-earnings when earnings are more than 14 days out", () => {
    const context: GetQueryAnalysisResponse = {
      ...baseContext,
      calendar: {
        recentEventTypes: [],
        nextEarningsAt: "2026-06-21T12:00:00.000Z",
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
    expect(result.firedRuleIds).not.toContain("near-earnings");
    expect(result.multipliers.kg_change).toBe(2);
    expect(result.multipliers.competitor).toBe(1.5);
  });
});

describe("applyEventBiasToIntentWeights", () => {
  it("multiplies only intents present in the bias map", () => {
    const adjusted = applyEventBiasToIntentWeights(
      {
        breaking: 1,
        kg_change: 0.8,
        fundamental: 0.6,
        sentiment: 0.5,
        competitor: 0.5,
        supply_chain: 0.4,
        esg: 0.3,
        macro: 0.4,
        technical: 0.3,
        wildcard: 0,
      },
      { fundamental: 2, sentiment: 1.5 },
    );

    expect(adjusted.fundamental).toBe(1.2);
    expect(adjusted.sentiment).toBe(0.75);
    expect(adjusted.breaking).toBe(1);
  });
});
