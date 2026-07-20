import { describe, it, expect } from "vitest";
import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";
import { createQueryAnalysisInsightsProvider } from "./query-analysis-insights-provider.js";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function makeDate(offsetMs: number): Date {
  return new Date(Date.now() - offsetMs);
}

const now = new Date();
const windowStart = new Date(now.getTime() - WINDOW_MS);
const priorStart = new Date(windowStart.getTime() - WINDOW_MS);

const baseSnapshot = {
  queryCount: 10,
  languageQuotas: [
    { language: "en", share: 0.7 },
    { language: "id", share: 0.3 },
  ],
  minDeterministicCount: 3,
  personas: ["value-investor", "trader"],
  sectionCoverage: { zeroCoverageSections: [] as string[] },
  selfCritiqueReplacedCount: 1,
  diversityScore: {
    lexicalDiversity: 0.8,
    intentCoverage: 0.9,
    personaCoverage: 0.75,
    semanticSpread: 0.6,
    composite: 0.76,
  },
  queryAttribution: [
    {
      text: "AAPL earnings",
      source: "llm",
      intent: "breaking",
      persona: "value-investor",
    },
    {
      text: "AAPL fundamentals",
      source: "deterministic",
      intent: "fundamental",
    },
    {
      text: "AAPL sentiment",
      source: "llm",
      intent: "sentiment",
      persona: "trader",
    },
  ],
};

function makeSets(count: number, offsetMs = WINDOW_MS / 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `set-${i}`,
    tickerId: "ticker-1",
    generatedAt: new Date(now.getTime() - offsetMs + i * 1000),
    strategySnapshot: baseSnapshot,
  }));
}

function makeQueries(setIds: string[]) {
  const intents = ["breaking", "fundamental", "sentiment"] as const;
  return setIds.flatMap((setId, i) => [
    {
      id: `q-${setId}-0`,
      setId,
      intent: intents[i % 3] ?? "breaking",
    },
    { id: `q-${setId}-1`, setId, intent: "competitor" },
    { id: `q-${setId}-2`, setId, intent: "breaking" },
  ]);
}

function makeYieldRows(queryTexts: string[], setId = "set-0") {
  return queryTexts.map((text, i) => ({
    searchQueryId: `qy-${i}`,
    runDate: makeDate(1000),
    articleCount: 10 - i,
    novelArticleCount: 5 - Math.min(i, 4),
    searchQuery: { text, setId },
  }));
}

type AnySetRow = {
  id: string;
  tickerId: string;
  generatedAt: Date;
  strategySnapshot: unknown;
};

function makeDeps(
  sets: AnySetRow[],
  queries: ReturnType<typeof makeQueries>,
  yields: ReturnType<typeof makeYieldRows>,
) {
  return {
    searchQuerySet: { findMany: async () => sets },
    searchQuery: { findMany: async () => queries },
    searchQueryYield: { findMany: async () => yields },
  };
}

describe("createQueryAnalysisInsightsProvider", () => {
  it("produces a payload that validates against insightsPayloadSchema", async () => {
    const sets = makeSets(3);
    const queries = makeQueries(sets.map((s) => s.id));
    const yields = makeYieldRows(["AAPL earnings", "AAPL fundamentals"]);

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, queries, yields),
    );
    const payload = await provider.compute({ window: "7d" });

    expect(() => insightsPayloadSchema.parse(payload)).not.toThrow();
    expect(payload.agentId).toBe("query-analysis");
  });

  it("diversity-axis section reads each axis from the latest diversityScore", async () => {
    const sets = makeSets(1);
    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const diversitySection = payload.sections.find(
      (s) => s.id === "why-diversity",
    );
    expect(diversitySection).toBeDefined();
    expect(diversitySection?.widget.kind).toBe("categoryBar");

    if (diversitySection?.widget.kind === "categoryBar") {
      const labels = diversitySection.widget.bars.map((b) => b.label);
      expect(labels).toContain("Lexical diversity");
      expect(labels).toContain("Intent coverage");
      expect(labels).not.toContain("Composite");
    }
  });

  it("skips diversity section when diversityScore is absent in strategySnapshot", async () => {
    const snapshotWithoutDiversity = {
      ...baseSnapshot,
      diversityScore: undefined,
    };
    const sets = [
      {
        id: "set-no-div",
        tickerId: "ticker-1",
        generatedAt: makeDate(1000),
        strategySnapshot: snapshotWithoutDiversity,
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const diversitySection = payload.sections.find(
      (s) => s.id === "why-diversity",
    );
    expect(diversitySection).toBeUndefined();
  });

  it("skips persona section when queryAttribution has no persona fields", async () => {
    const snapshotNoPersona = {
      ...baseSnapshot,
      queryAttribution: [
        { text: "AAPL earnings", source: "llm", intent: "breaking" },
      ],
    };
    const sets = [
      {
        id: "set-np",
        tickerId: "ticker-1",
        generatedAt: makeDate(1000),
        strategySnapshot: snapshotNoPersona,
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const personaSection = payload.sections.find(
      (s) => s.id === "who-persona-coverage",
    );
    expect(personaSection).toBeUndefined();
  });

  it("intent categoryBar counts SearchQuery.intent values", async () => {
    const sets = makeSets(1);
    const queries = [
      { id: "q-0", setId: "set-0", intent: "breaking" },
      { id: "q-1", setId: "set-0", intent: "breaking" },
      {
        id: "q-2",
        setId: "set-0",
        intent: "fundamental",
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, queries, []),
    );
    const payload = await provider.compute({ window: "7d" });

    const intentSection = payload.sections.find(
      (s) => s.id === "how-intent-distribution",
    );
    expect(intentSection?.widget.kind).toBe("categoryBar");

    if (intentSection?.widget.kind === "categoryBar") {
      const breakingBar = intentSection.widget.bars.find(
        (b) => b.label === "breaking",
      );
      expect(breakingBar?.value).toBe(2);
    }
  });

  it("yield table ranks by novelArticleCount and respects top-N cap", async () => {
    const sets = makeSets(1);
    const yieldData = Array.from({ length: 15 }, (_, i) => ({
      searchQueryId: `qy-${i}`,
      runDate: makeDate(1000),
      articleCount: i + 1,
      novelArticleCount: 15 - i,
      searchQuery: { text: `query ${i}`, setId: "set-0" },
    }));

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], yieldData),
    );
    const payload = await provider.compute({ window: "7d" });

    const yieldSection = payload.sections.find(
      (s) => s.id === "how-yield-feedback",
    );
    expect(yieldSection).toBeDefined();
    expect(yieldSection?.widget.kind).toBe("table");

    if (yieldSection?.widget.kind === "table") {
      expect(yieldSection.widget.rows.length).toBeLessThanOrEqual(10);
      expect(yieldSection.widget.rows[0]?.[0]).toBe("query 0");
    }
  });

  it("KPI delta reflects prior-window comparison", async () => {
    const currentSets = makeSets(3, WINDOW_MS / 2);
    const priorSet = {
      id: "set-prior",
      tickerId: "ticker-1",
      generatedAt: new Date(priorStart.getTime() + 1000),
      strategySnapshot: baseSnapshot,
    };
    const allSets = [...currentSets, priorSet];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(allSets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const setsKpi = payload.kpis.find((k) => k.id === "sets_generated");
    expect(setsKpi?.value).toBe(3);
    expect(typeof setsKpi?.delta).toBe("number");
    expect(setsKpi?.delta).toBe(3 - 1);
  });

  it("low diversity score triggers a warning alert", async () => {
    const lowDiversitySnapshot = {
      ...baseSnapshot,
      diversityScore: { composite: 0.3, lexicalDiversity: 0.3 },
    };
    const sets = [
      {
        id: "set-low",
        tickerId: "ticker-1",
        generatedAt: makeDate(1000),
        strategySnapshot: lowDiversitySnapshot,
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const alert = payload.alerts.find((a) => a.id === "low-diversity-score");
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe("warning");
  });

  it("produces a valid empty payload when no sets exist", async () => {
    const provider = createQueryAnalysisInsightsProvider(makeDeps([], [], []));
    const payload = await provider.compute({ window: "7d" });

    expect(() => insightsPayloadSchema.parse(payload)).not.toThrow();
    expect(payload.kpis.find((k) => k.id === "sets_generated")?.value).toBe(0);
    expect(
      payload.sections.find((s) => s.id === "why-diversity"),
    ).toBeUndefined();
  });

  it("top-N capping for language quotas does not produce unbounded arrays", async () => {
    const manyLanguagesSnapshot = {
      ...baseSnapshot,
      languageQuotas: Array.from({ length: 15 }, (_, i) => ({
        language: `lang-${i}`,
        share: 1 / 15,
      })),
    };
    const sets = [
      {
        id: "set-many-langs",
        tickerId: "ticker-1",
        generatedAt: makeDate(1000),
        strategySnapshot: manyLanguagesSnapshot,
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const langSection = payload.sections.find(
      (s) => s.id === "where-language-quotas",
    );
    expect(langSection?.widget.kind).toBe("categoryBar");

    if (langSection?.widget.kind === "categoryBar") {
      expect(langSection.widget.bars.length).toBeLessThanOrEqual(11);
      const otherBar = langSection.widget.bars.find((b) => b.label === "Other");
      expect(otherBar).toBeDefined();
    }
  });

  it("does not crash when strategySnapshot is malformed", async () => {
    const malformedSets = [
      {
        id: "set-bad",
        tickerId: "ticker-1",
        generatedAt: makeDate(1000),
        strategySnapshot: "not-an-object" as unknown as Record<string, unknown>,
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(malformedSets, [], []),
    );

    await expect(provider.compute({ window: "7d" })).resolves.not.toThrow();
    const payload = await provider.compute({ window: "7d" });
    expect(() => insightsPayloadSchema.parse(payload)).not.toThrow();
  });

  it("surfaces quickHits as a zero-coverage alert like any other section", async () => {
    const snapshotWithQuickHitsZero = {
      ...baseSnapshot,
      sectionCoverage: {
        zeroCoverageSections: ["quickHits", "dealsAndMovements"],
      },
    };
    const sets = Array.from({ length: 4 }, (_, i) => ({
      id: `set-${i}`,
      tickerId: "ticker-1",
      generatedAt: makeDate(i * 1000),
      strategySnapshot: snapshotWithQuickHitsZero,
    }));

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const quickHitsAlert = payload.alerts.find((alert) =>
      alert.id.includes("quickHits"),
    );

    expect(quickHitsAlert).toBeDefined();
    expect(quickHitsAlert?.severity).toBe("warning");
  });

  it("does not surface competitiveLandscape as zero-coverage when it is covered in >50% of sets", async () => {
    const snapshotCovered = {
      ...baseSnapshot,
      sectionCoverage: {
        zeroCoverageSections: [],
      },
    };
    const snapshotUncovered = {
      ...baseSnapshot,
      sectionCoverage: {
        zeroCoverageSections: ["competitiveLandscape"],
      },
    };
    // Only 1 of 4 sets has competitiveLandscape at zero (25%), below the 50% threshold.
    const sets = [
      {
        id: "set-0",
        tickerId: "ticker-1",
        generatedAt: makeDate(0),
        strategySnapshot: snapshotUncovered,
      },
      {
        id: "set-1",
        tickerId: "ticker-1",
        generatedAt: makeDate(1000),
        strategySnapshot: snapshotCovered,
      },
      {
        id: "set-2",
        tickerId: "ticker-1",
        generatedAt: makeDate(2000),
        strategySnapshot: snapshotCovered,
      },
      {
        id: "set-3",
        tickerId: "ticker-1",
        generatedAt: makeDate(3000),
        strategySnapshot: snapshotCovered,
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const alert = payload.alerts.find(
      (alert) => alert.id === "zero-coverage-competitiveLandscape",
    );
    expect(alert).toBeUndefined();
  });

  it("does not surface disruptorsOrTech as zero-coverage when it is covered in most sets", async () => {
    const snapshotCovered = {
      ...baseSnapshot,
      sectionCoverage: { zeroCoverageSections: [] },
    };
    const snapshotUncovered = {
      ...baseSnapshot,
      sectionCoverage: { zeroCoverageSections: ["disruptorsOrTech"] },
    };
    const sets = [
      {
        id: "set-0",
        tickerId: "ticker-1",
        generatedAt: makeDate(0),
        strategySnapshot: snapshotUncovered,
      },
      {
        id: "set-1",
        tickerId: "ticker-1",
        generatedAt: makeDate(1000),
        strategySnapshot: snapshotCovered,
      },
      {
        id: "set-2",
        tickerId: "ticker-1",
        generatedAt: makeDate(2000),
        strategySnapshot: snapshotCovered,
      },
    ];

    const provider = createQueryAnalysisInsightsProvider(
      makeDeps(sets, [], []),
    );
    const payload = await provider.compute({ window: "7d" });

    const alert = payload.alerts.find(
      (alert) => alert.id === "zero-coverage-disruptorsOrTech",
    );
    expect(alert).toBeUndefined();
  });
});
