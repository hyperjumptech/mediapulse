import { describe, expect, it } from "vitest";

import { selectArticles } from "./select-articles.js";
import type { SourceForGeneration } from "./types.js";

const source = (
  overrides: Partial<SourceForGeneration> & { title: string },
): SourceForGeneration => ({
  url: `https://example.com/${overrides.title.toLowerCase().replace(/\s+/g, "-")}`,
  content: "Body.",
  ...overrides,
});

describe("selectArticles", () => {
  it("keeps the highest-scoring three articles in a section", () => {
    const sources = [
      source({
        title: "Fourth",
        section: "competitiveLandscape",
        sectionScore: 0.1,
      }),
      source({
        title: "First",
        section: "competitiveLandscape",
        sectionScore: 0.9,
      }),
      source({
        title: "Third",
        section: "competitiveLandscape",
        sectionScore: 0.5,
      }),
      source({
        title: "Second",
        section: "competitiveLandscape",
        sectionScore: 0.7,
      }),
    ];

    const { selected, report } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(report.droppedOverCap).toBe(1);
  });

  it("emits sections in canonical order regardless of input order", () => {
    const sources = [
      source({ title: "Hit", section: "quickHits", sectionScore: 0.5 }),
      source({
        title: "Deal",
        section: "dealsAndMovements",
        sectionScore: 0.5,
      }),
      source({ title: "Pulse", section: "industryPulse", sectionScore: 0.5 }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.sectionKey)).toStrictEqual([
      "industry-pulse",
      "deals-and-movements",
      "quick-hits",
    ]);
  });

  it("drops sources with no assigned section", () => {
    const sources = [
      source({
        title: "Assigned",
        section: "industryPulse",
        sectionScore: 0.4,
      }),
      source({ title: "Unassigned", section: null, sectionScore: 0.9 }),
      source({ title: "Unknown", section: "notASection", sectionScore: 0.9 }),
    ];

    const { selected, report } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Assigned",
    ]);
    expect(report.droppedUnassigned).toBe(2);
  });

  it("breaks score ties on input order so the result is stable", () => {
    const sources = [
      source({ title: "Earlier", section: "quickHits", sectionScore: 0.5 }),
      source({ title: "Later", section: "quickHits", sectionScore: 0.5 }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Earlier",
      "Later",
    ]);
  });

  it("treats a missing score as zero rather than dropping the article", () => {
    const sources = [
      source({ title: "Unscored", section: "quickHits" }),
      source({ title: "Scored", section: "quickHits", sectionScore: 0.2 }),
    ];

    const { selected } = selectArticles(sources);

    expect(selected.map((entry) => entry.source.title)).toStrictEqual([
      "Scored",
      "Unscored",
    ]);
  });

  it("returns nothing when no source carries a section", () => {
    const { selected, report } = selectArticles([source({ title: "Orphan" })]);

    expect(selected).toStrictEqual([]);
    expect(report.droppedUnassigned).toBe(1);
  });
});
