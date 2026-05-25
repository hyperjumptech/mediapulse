/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

import {
  collectOrderedKgRelationRows,
  extractSlotsFromPattern,
  formatCurrentQuarter,
  resolveSlots,
  resolveTemplatePattern,
} from "./slot-resolver";

const FIXED_CLOCK = (): Date => new Date("2026-05-21T12:00:00.000Z");

const emptyEnrichedContext = {
  peers: [] as [],
  calendar: { recentEventTypes: [] as string[] },
  headlineSamples: [] as [],
  kgNeighborhood: [] as [],
};

const fullContext: GetQueryAnalysisResponse = {
  ticker: {
    id: "11111111-1111-4111-a111-111111111111",
    symbol: "ACME",
    name: "Acme Co",
    metadata: null,
  },
  topEntities: [
    {
      canonicalName: "Subsidiary Inc",
      typeName: "Organization",
      relevanceWeight: 0.9,
    },
  ],
  recentThemes: [{ theme: "AI", articleCount: 3 }],
  ...emptyEnrichedContext,
};

const sparseContext: GetQueryAnalysisResponse = {
  ticker: {
    id: "22222222-2222-4222-a222-222222222222",
    symbol: "ABC",
    name: "ABC Ltd",
    metadata: null,
  },
  topEntities: [],
  recentThemes: [],
  ...emptyEnrichedContext,
};

describe("formatCurrentQuarter", () => {
  it("formats May as Q2 of the calendar year", () => {
    // Act
    const label = formatCurrentQuarter(new Date("2026-05-21T00:00:00.000Z"));

    // Assert
    expect(label).toBe("Q2 2026");
  });
});

describe("extractSlotsFromPattern", () => {
  it("returns unique slot names in order of first appearance", () => {
    // Act
    const slots = extractSlotsFromPattern(
      "{name} {recentTheme} and {name} again",
    );

    // Assert
    expect(slots).toEqual(["name", "recentTheme"]);
  });
});

describe("resolveSlots", () => {
  it("resolves calendar slots from a fixed clock", () => {
    // Act
    const slots = resolveSlots(sparseContext, FIXED_CLOCK);

    // Assert
    expect(slots.currentQuarter).toBe("Q2 2026");
    expect(slots.currentYear).toBe("2026");
    expect(slots.currentMonth).toBe("May");
  });

  it("includes context-dependent slots when data is present", () => {
    // Act
    const slots = resolveSlots(fullContext, FIXED_CLOCK);

    // Assert
    expect(slots.topEntity).toBe("Subsidiary Inc");
    expect(slots.recentTheme).toBe("AI");
  });

  it("omits context-dependent slots when arrays are empty", () => {
    // Act
    const slots = resolveSlots(sparseContext, FIXED_CLOCK);

    // Assert
    expect(slots.topEntity).toBeUndefined();
    expect(slots.recentTheme).toBeUndefined();
    expect(slots.daysToEarnings).toBeUndefined();
    expect(slots.lastEventType).toBeUndefined();
  });

  it("resolves sector and industry slots from ticker metadata", () => {
    const context: GetQueryAnalysisResponse = {
      ...sparseContext,
      ticker: {
        ...sparseContext.ticker,
        metadata: { Sektor: "Telekomunikasi", Industri: "Telecom" },
      },
    };

    const slots = resolveSlots(context, FIXED_CLOCK);

    expect(slots.sector).toBe("Telekomunikasi");
    expect(slots.industry).toBe("Telecom");
  });

  it("resolves earnings and calendar slots when present", () => {
    const context: GetQueryAnalysisResponse = {
      ...sparseContext,
      calendar: {
        recentEventTypes: ["regulatory_filing"],
        nextEarningsAt: "2026-05-28T12:00:00.000Z",
      },
    };

    const slots = resolveSlots(context, FIXED_CLOCK);

    expect(slots.daysToEarnings).toBe("7");
    expect(slots.lastEventType).toBe("regulatory_filing");
  });
});

describe("collectOrderedKgRelationRows", () => {
  it("drains relation deltas before static neighborhood rows", () => {
    const context: GetQueryAnalysisResponse = {
      ...sparseContext,
      recentRelationDeltas: [
        {
          fromEntity: "Acme Co",
          toEntity: "Delta One",
          relationType: "supplies",
          change: "added",
        },
      ],
      kgNeighborhood: [
        {
          fromEntity: "Acme Co",
          toEntity: "Nb One",
          relationType: "partners_with",
        },
      ],
    };

    const rows = collectOrderedKgRelationRows(context, 2);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.source).toBe("delta");
    expect(rows[0]?.toEntity).toBe("Delta One");
    expect(rows[1]?.source).toBe("neighborhood");
    expect(rows[1]?.toEntity).toBe("Nb One");
  });
});

describe("resolveTemplatePattern", () => {
  it("fills all slots in a fully populated pattern", () => {
    // Setup
    const slots = resolveSlots(fullContext, FIXED_CLOCK);

    // Act
    const text = resolveTemplatePattern("{name} {recentTheme} impact", slots);

    // Assert
    expect(text).toBe("Acme Co AI impact");
  });

  it("returns null when a required slot is unresolved", () => {
    // Setup
    const slots = resolveSlots(sparseContext, FIXED_CLOCK);

    // Act
    const text = resolveTemplatePattern("{name} {recentTheme} impact", slots);

    // Assert
    expect(text).toBeNull();
  });

  it("never emits literal brace tokens for resolved patterns", () => {
    // Setup
    const slots = resolveSlots(sparseContext, FIXED_CLOCK);

    // Act
    const text = resolveTemplatePattern("{symbol} latest news", slots);

    // Assert
    expect(text).toBe("ABC latest news");
    expect(text).not.toContain("{");
  });
});
