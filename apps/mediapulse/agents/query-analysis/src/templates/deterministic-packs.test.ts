/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

import { buildDeterministicQueries } from "./build-deterministic-queries";
import {
  DETERMINISTIC_PACKS,
  getDeterministicPack,
  MAX_TEMPLATES_PER_PACK,
} from "./deterministic-packs";

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

describe("getDeterministicPack", () => {
  it("returns default-v1 for unknown pack names", () => {
    // Act
    const pack = getDeterministicPack("unknown-pack");

    // Assert
    expect(pack.name).toBe("default-v1");
  });
});

describe("default-v1 pack", () => {
  it("reproduces the original five baseline queries", () => {
    // Act
    const queries = buildDeterministicQueries(fullContext, {
      pack: "default-v1",
      clock: FIXED_CLOCK,
    });

    // Assert
    expect(queries).toEqual([
      { text: "ACME latest news", intent: "breaking" },
      { text: "Acme Co breaking news", intent: "breaking" },
      { text: "Acme Co relation changes", intent: "kg_change" },
      { text: "Acme Co earnings guidance", intent: "fundamental" },
      { text: "Acme Co regulatory update", intent: "fundamental" },
    ]);
  });
});

describe("rich-v2 pack", () => {
  it("yields at least fifteen distinct rows for a fully populated context", () => {
    // Act
    const queries = buildDeterministicQueries(fullContext, {
      pack: "rich-v2",
      clock: FIXED_CLOCK,
    });
    const distinctTexts = new Set(queries.map((row) => row.text));

    // Assert
    expect(queries.length).toBeGreaterThanOrEqual(15);
    expect(distinctTexts.size).toBe(queries.length);
  });

  it("covers all three intent categories", () => {
    // Act
    const queries = buildDeterministicQueries(fullContext, {
      pack: "rich-v2",
      clock: FIXED_CLOCK,
    });
    const intents = new Set(queries.map((row) => row.intent));

    // Assert
    expect(intents.has("breaking")).toBe(true);
    expect(intents.has("kg_change")).toBe(true);
    expect(intents.has("fundamental")).toBe(true);
  });

  it("drops theme-coupled templates when recent themes are absent", () => {
    // Setup
    const sparseContext: GetQueryAnalysisResponse = {
      ...fullContext,
      recentThemes: [],
    };

    // Act
    const queries = buildDeterministicQueries(sparseContext, {
      pack: "rich-v2",
      clock: FIXED_CLOCK,
    });

    // Assert
    expect(queries.every((row) => !row.text.includes("{recentTheme}"))).toBe(
      true,
    );
    expect(queries.every((row) => !row.text.includes("AI"))).toBe(true);
  });

  it("stays within the pack template cap", () => {
    // Assert
    expect(DETERMINISTIC_PACKS["rich-v2"].templates.length).toBeLessThanOrEqual(
      MAX_TEMPLATES_PER_PACK,
    );
  });
});
