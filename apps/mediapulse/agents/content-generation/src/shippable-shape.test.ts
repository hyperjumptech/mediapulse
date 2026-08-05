/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  computeShippableShape,
  isBelowShippableFloor,
} from "./shippable-shape.js";

const sourcesFor = (
  sectionCounts: Record<string, number>,
): { section: string }[] =>
  Object.entries(sectionCounts).flatMap(([section, count]) =>
    Array.from({ length: count }, () => ({ section })),
  );

const FLOOR = { minShippableArticles: 2, minShippableSections: 2 };

describe("computeShippableShape", () => {
  it("ignores sources that were never assigned a section", () => {
    const shape = computeShippableShape([
      { section: "industryPulse" },
      { section: null },
      { section: undefined },
      { section: "   " },
    ]);

    expect(shape).toEqual({ articleCount: 1, sectionCount: 1 });
  });

  it("caps each section at the per-section maximum, as selection does", () => {
    const shape = computeShippableShape(
      sourcesFor({ industryPulse: 7, quickHits: 1 }),
    );

    expect(shape).toEqual({ articleCount: 4, sectionCount: 2 });
  });

  it("returns an empty shape for no sources", () => {
    expect(computeShippableShape([])).toEqual({
      articleCount: 0,
      sectionCount: 0,
    });
  });
});

describe("isBelowShippableFloor", () => {
  it("suppresses a single item in a single section", () => {
    const shape = computeShippableShape(
      sourcesFor({ competitiveLandscape: 1 }),
    );

    expect(isBelowShippableFloor(shape, FLOOR)).toBe(true);
  });

  it("suppresses two items crammed into one section", () => {
    const shape = computeShippableShape(
      sourcesFor({ competitiveLandscape: 2 }),
    );

    expect(isBelowShippableFloor(shape, FLOOR)).toBe(true);
  });

  it("ships a two-item issue spread across two sections", () => {
    const shape = computeShippableShape(
      sourcesFor({ competitiveLandscape: 1, dealsAndMovements: 1 }),
    );

    expect(isBelowShippableFloor(shape, FLOOR)).toBe(false);
  });
});

describe("calibration against the 2026-08-05 batch", () => {
  /** Section counts of every issue generated on 2026-08-05, by ticker. */
  const generatedIssues: Record<string, Record<string, number>> = {
    AADI: { industryPulse: 2, regulatoryPolicyWatch: 1 },
    ACES: { competitiveLandscape: 1, dealsAndMovements: 1 },
    AGRO: { industryPulse: 1, quickHits: 1 },
    AMAN: { industryPulse: 3, regulatoryPolicyWatch: 3 },
    ANTM: {
      competitiveLandscape: 3,
      dealsAndMovements: 1,
      regulatoryPolicyWatch: 1,
      quickHits: 3,
    },
    BABY: { competitiveLandscape: 1, dealsAndMovements: 1 },
    BBCA: {
      industryPulse: 2,
      dealsAndMovements: 1,
      regulatoryPolicyWatch: 3,
    },
    BMRI: {
      industryPulse: 2,
      competitiveLandscape: 3,
      regulatoryPolicyWatch: 1,
      quickHits: 1,
    },
    ERAA: { competitiveLandscape: 2, quickHits: 1 },
    EXCL: { industryPulse: 1, dealsAndMovements: 1 },
    GOTO: { competitiveLandscape: 3, dealsAndMovements: 2, quickHits: 1 },
    LUCY: { competitiveLandscape: 1, regulatoryPolicyWatch: 1 },
    MAPA: { competitiveLandscape: 2, dealsAndMovements: 3 },
    MORA: { competitiveLandscape: 1, dealsAndMovements: 1 },
    SMMA: { competitiveLandscape: 1, regulatoryPolicyWatch: 3 },
    SOHO: { competitiveLandscape: 1 },
    TLKM: {
      competitiveLandscape: 2,
      dealsAndMovements: 3,
      regulatoryPolicyWatch: 2,
      disruptorsOrTech: 1,
      quickHits: 1,
    },
  };

  it("suppresses only the single-item issue, and no other", () => {
    const suppressed = Object.entries(generatedIssues)
      .filter(([, sections]) =>
        isBelowShippableFloor(
          computeShippableShape(sourcesFor(sections)),
          FLOOR,
        ),
      )
      .map(([symbol]) => symbol);

    expect(suppressed).toEqual(["SOHO"]);
  });

  it("keeps the two issues that scored highest on review", () => {
    for (const symbol of ["ACES", "LUCY"]) {
      const shape = computeShippableShape(
        sourcesFor(generatedIssues[symbol] ?? {}),
      );

      expect(isBelowShippableFloor(shape, FLOOR)).toBe(false);
    }
  });

  it("would take six sound issues with it if the article floor were raised to three", () => {
    const suppressed = Object.entries(generatedIssues)
      .filter(([, sections]) =>
        isBelowShippableFloor(computeShippableShape(sourcesFor(sections)), {
          minShippableArticles: 3,
          minShippableSections: 2,
        }),
      )
      .map(([symbol]) => symbol)
      .filter((symbol) => symbol !== "SOHO");

    expect(suppressed).toEqual([
      "ACES",
      "AGRO",
      "BABY",
      "EXCL",
      "LUCY",
      "MORA",
    ]);
  });
});
