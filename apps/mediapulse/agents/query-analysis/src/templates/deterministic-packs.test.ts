/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

import { buildDeterministicQueries } from "./build-deterministic-queries";
import {
  DETERMINISTIC_PACKS,
  filterPackTemplatesByYield,
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
      {
        text: "ACME latest news",
        intent: "breaking",
        templateId: "{symbol} latest news",
      },
      {
        text: "Acme Co breaking news",
        intent: "breaking",
        templateId: "{name} breaking news",
      },
      {
        text: "Acme Co relation changes",
        intent: "kg_change",
        templateId: "{name} relation changes",
      },
      {
        text: "Acme Co earnings guidance",
        intent: "fundamental",
        templateId: "{name} earnings guidance",
      },
      {
        text: "Acme Co regulatory update",
        intent: "fundamental",
        templateId: "{name} regulatory update",
      },
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

describe("rich-v2-extended pack", () => {
  it("covers every intent in the expanded taxonomy", () => {
    const queries = buildDeterministicQueries(fullContext, {
      pack: "rich-v2-extended",
      clock: FIXED_CLOCK,
    });
    const intents = new Set(queries.map((row) => row.intent));
    expect(intents.has("breaking")).toBe(true);
    expect(intents.has("kg_change")).toBe(true);
    expect(intents.has("fundamental")).toBe(true);
    expect(intents.has("sentiment")).toBe(true);
    expect(intents.has("competitor")).toBe(true);
    expect(intents.has("supply_chain")).toBe(true);
    expect(intents.has("esg")).toBe(true);
    expect(intents.has("macro")).toBe(true);
    expect(intents.has("technical")).toBe(true);
  });

  it("stays within the pack template cap", () => {
    expect(
      DETERMINISTIC_PACKS["rich-v2-extended"].templates.length,
    ).toBeLessThanOrEqual(MAX_TEMPLATES_PER_PACK);
  });
});

describe("kg-aware-v1 pack", () => {
  const kgContext: GetQueryAnalysisResponse = {
    ...fullContext,
    recentRelationDeltas: [
      {
        fromEntity: "Acme Co",
        toEntity: "Delta One",
        relationType: "supplies",
        change: "added",
      },
      {
        fromEntity: "Acme Co",
        toEntity: "Delta Two",
        relationType: "partners_with",
        change: "updated",
      },
      {
        fromEntity: "Acme Co",
        toEntity: "Delta Three",
        relationType: "competes_with",
        change: "removed",
      },
    ],
    kgNeighborhood: [
      {
        fromEntity: "Acme Co",
        toEntity: "Nb One",
        relationType: "supplies",
      },
      {
        fromEntity: "Acme Co",
        toEntity: "Nb Two",
        relationType: "partners_with",
      },
      {
        fromEntity: "Acme Co",
        toEntity: "Nb Three",
        relationType: "competes_with",
      },
      {
        fromEntity: "Acme Co",
        toEntity: "Nb Four",
        relationType: "regulates",
      },
    ],
  };

  it("expands deltas first then neighborhood rows up to kgTemplateCap", () => {
    const queries = buildDeterministicQueries(kgContext, {
      pack: "kg-aware-v1",
      clock: FIXED_CLOCK,
      kgTemplateCap: 6,
    });

    const kgQueries = queries.filter(
      (row) =>
        row.text.includes("Delta One") ||
        row.text.includes("Delta Two") ||
        row.text.includes("Delta Three") ||
        row.text.includes("Nb One") ||
        row.text.includes("Nb Two") ||
        row.text.includes("Nb Three") ||
        row.text.includes("Nb Four"),
    );

    expect(kgQueries).toHaveLength(6);
    expect(kgQueries[0]?.text).toContain("Delta One");
    expect(kgQueries[1]?.text).toContain("Delta Two");
    expect(kgQueries[2]?.text).toContain("Delta Three");
    expect(kgQueries[3]?.text).toContain("Nb One");
    expect(kgQueries[4]?.text).toContain("Nb Two");
    expect(kgQueries[5]?.text).toContain("Nb Three");
    expect(kgQueries.every((row) => !row.text.includes("Nb Four"))).toBe(true);
  });

  it("tags delta rows as kg_change and neighborhood rows as competitor", () => {
    const queries = buildDeterministicQueries(kgContext, {
      pack: "kg-aware-v1",
      clock: FIXED_CLOCK,
      kgTemplateCap: 6,
    });

    const deltaQueries = queries.filter((row) => row.text.includes("Delta"));
    const neighborhoodQueries = queries.filter((row) =>
      row.text.includes("Nb "),
    );

    expect(deltaQueries.every((row) => row.intent === "kg_change")).toBe(true);
    expect(
      neighborhoodQueries.every((row) => row.intent === "competitor"),
    ).toBe(true);
  });

  it("skips KG expansion when kgTemplateCap is zero", () => {
    const queries = buildDeterministicQueries(kgContext, {
      pack: "kg-aware-v1",
      clock: FIXED_CLOCK,
      kgTemplateCap: 0,
    });

    expect(queries.every((row) => !row.text.includes("Delta One"))).toBe(true);
    expect(queries.every((row) => !row.text.includes("Nb One"))).toBe(true);
  });
});

describe("filterPackTemplatesByYield", () => {
  it("removes templates below the minimum novel-yield threshold", () => {
    const pack = getDeterministicPack("default-v1");
    const filtered = filterPackTemplatesByYield(
      pack,
      {
        perTemplate: [
          {
            templateId: "{symbol} latest news",
            avgArticles: 0,
            avgNovel: 0.01,
          },
          {
            templateId: "{name} breaking news",
            avgArticles: 2,
            avgNovel: 0.2,
          },
        ],
        perIntent: [],
        perPersona: [],
      },
      0.05,
    );

    expect(filtered.templates.map((row) => row.template)).toEqual([
      "{name} breaking news",
      "{name} relation changes",
      "{name} earnings guidance",
      "{name} regulatory update",
    ]);
  });

  it("keeps the original pack when every template is below threshold", () => {
    const pack = getDeterministicPack("default-v1");
    const filtered = filterPackTemplatesByYield(
      pack,
      {
        perTemplate: pack.templates.map((row) => ({
          templateId: row.template,
          avgArticles: 0,
          avgNovel: 0,
        })),
        perIntent: [],
        perPersona: [],
      },
      0.05,
    );

    expect(filtered.templates).toEqual(pack.templates);
  });
});
