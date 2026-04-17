/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { applyRelevanceSelection } from "./analysis-relevance-selection.js";

describe("applyRelevanceSelection", () => {
  it("marks top scores when above min and within budget", () => {
    const rows = [
      {
        dataSourceId: "a",
        score: 0.9,
        scoreBreakdown: {
          _version: 1,
          breakingNews: 1,
          kgRelation: 1,
          fundamental: 1,
          tickerSalience: 1,
          sourceQuality: 1,
        },
        selected: false,
        _sortCreatedAt: new Date("2026-04-09T10:00:00Z"),
      },
      {
        dataSourceId: "b",
        score: 0.4,
        scoreBreakdown: {
          _version: 1,
          breakingNews: 1,
          kgRelation: 1,
          fundamental: 1,
          tickerSalience: 1,
          sourceQuality: 1,
        },
        selected: false,
        _sortCreatedAt: new Date("2026-04-09T11:00:00Z"),
      },
    ];

    const out = applyRelevanceSelection(rows, 0.35, 1);

    expect(out.find((r) => r.dataSourceId === "a")?.selected).toBe(true);
    expect(out.find((r) => r.dataSourceId === "b")?.selected).toBe(false);
  });

  it("prefers newer tie-break at equal score", () => {
    const rows = [
      {
        dataSourceId: "old",
        score: 0.8,
        scoreBreakdown: {
          _version: 1,
          breakingNews: 1,
          kgRelation: 1,
          fundamental: 1,
          tickerSalience: 1,
          sourceQuality: 1,
        },
        selected: false,
        _sortCreatedAt: new Date("2026-04-09T09:00:00Z"),
      },
      {
        dataSourceId: "new",
        score: 0.8,
        scoreBreakdown: {
          _version: 1,
          breakingNews: 1,
          kgRelation: 1,
          fundamental: 1,
          tickerSalience: 1,
          sourceQuality: 1,
        },
        selected: false,
        _sortCreatedAt: new Date("2026-04-09T12:00:00Z"),
      },
    ];

    const out = applyRelevanceSelection(rows, 0, 1);
    expect(out.find((r) => r.dataSourceId === "new")?.selected).toBe(true);
    expect(out.find((r) => r.dataSourceId === "old")?.selected).toBe(false);
  });
});
