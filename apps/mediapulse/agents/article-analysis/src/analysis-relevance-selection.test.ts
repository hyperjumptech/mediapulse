/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { PerSourceRelevanceSignals } from "./analysis-relevance-scoring.js";
import {
  applyRelevanceSelection,
  applyRelevanceSelectionDiversified,
} from "./analysis-relevance-selection.js";

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

const breakdown = {
  _version: 1,
  breakingNews: 1,
  kgRelation: 1,
  fundamental: 1,
  tickerSalience: 1,
  sourceQuality: 1,
} as const;

const clusterASignals = (): PerSourceRelevanceSignals[] => [
  {
    dataSourceId: "a-high",
    createdAt: new Date("2026-06-01T12:00:00Z"),
    entityCount: 3,
    relationCount: 0,
    mentionCount: 0,
    avgMentionConfidence: 0,
    titleLower: "apple beats q2 earnings estimates as services grow",
    textLower: "",
    entityNames: ["apple", "tim cook", "iphone"],
  },
  {
    dataSourceId: "a-mid",
    createdAt: new Date("2026-06-01T11:00:00Z"),
    entityCount: 3,
    relationCount: 0,
    mentionCount: 0,
    avgMentionConfidence: 0,
    titleLower: "apple beats q2 earnings estimates and services grow",
    textLower: "",
    entityNames: ["apple", "tim cook", "iphone"],
  },
  {
    dataSourceId: "a-low",
    createdAt: new Date("2026-06-01T10:00:00Z"),
    entityCount: 3,
    relationCount: 0,
    mentionCount: 0,
    avgMentionConfidence: 0,
    titleLower: "apple beats q2 earnings estimates services update",
    textLower: "",
    entityNames: ["apple", "tim cook", "iphone"],
  },
];

const clusterBSignals = (): PerSourceRelevanceSignals[] => [
  {
    dataSourceId: "b-high",
    createdAt: new Date("2026-06-01T09:00:00Z"),
    entityCount: 2,
    relationCount: 0,
    mentionCount: 0,
    avgMentionConfidence: 0,
    titleLower: "microsoft cloud revenue accelerates in q2",
    textLower: "",
    entityNames: ["microsoft", "azure"],
  },
  {
    dataSourceId: "b-low",
    createdAt: new Date("2026-06-01T08:00:00Z"),
    entityCount: 2,
    relationCount: 0,
    mentionCount: 0,
    avgMentionConfidence: 0,
    titleLower: "microsoft azure growth outlook for q2",
    textLower: "",
    entityNames: ["microsoft", "azure"],
  },
];

describe("applyRelevanceSelectionDiversified", () => {
  it("picks cluster representatives first then fills budget by score", () => {
    const rows = [
      {
        dataSourceId: "a-high",
        score: 0.9,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T12:00:00Z"),
      },
      {
        dataSourceId: "a-mid",
        score: 0.85,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T11:00:00Z"),
      },
      {
        dataSourceId: "b-high",
        score: 0.8,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T09:00:00Z"),
      },
      {
        dataSourceId: "a-low",
        score: 0.7,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T10:00:00Z"),
      },
      {
        dataSourceId: "b-low",
        score: 0.6,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T08:00:00Z"),
      },
    ];

    const perSource = [...clusterASignals(), ...clusterBSignals()];
    const result = applyRelevanceSelectionDiversified(rows, perSource, {
      minScore: 0.5,
      remainingBudget: 4,
    });

    expect(result.stats.clustersFormed).toBe(2);
    expect(result.stats.largestClusterSize).toBe(3);
    expect(
      result.rows.find((row) => row.dataSourceId === "a-high")?.selected,
    ).toBe(true);
    expect(
      result.rows.find((row) => row.dataSourceId === "b-high")?.selected,
    ).toBe(true);
    expect(
      result.rows.find((row) => row.dataSourceId === "a-mid")?.selected,
    ).toBe(true);
    expect(
      result.rows.find((row) => row.dataSourceId === "a-low")?.selected,
    ).toBe(true);
    expect(
      result.rows.find((row) => row.dataSourceId === "b-low")?.selected,
    ).toBe(false);
    expect(result.stats.selectedAfterDiversification).toBe(4);
  });

  it("counts suppressed duplicates when budget forces cross-cluster picks", () => {
    const rows = [
      {
        dataSourceId: "a-high",
        score: 0.9,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T12:00:00Z"),
      },
      {
        dataSourceId: "a-mid",
        score: 0.85,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T11:00:00Z"),
      },
      {
        dataSourceId: "b-high",
        score: 0.8,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T09:00:00Z"),
      },
      {
        dataSourceId: "a-low",
        score: 0.7,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T10:00:00Z"),
      },
      {
        dataSourceId: "b-low",
        score: 0.6,
        scoreBreakdown: breakdown,
        selected: false,
        _sortCreatedAt: new Date("2026-06-01T08:00:00Z"),
      },
    ];

    const result = applyRelevanceSelectionDiversified(
      rows,
      [...clusterASignals(), ...clusterBSignals()],
      { minScore: 0.5, remainingBudget: 2 },
    );

    expect(
      result.rows.find((row) => row.dataSourceId === "a-high")?.selected,
    ).toBe(true);
    expect(
      result.rows.find((row) => row.dataSourceId === "b-high")?.selected,
    ).toBe(true);
    expect(
      result.rows.find((row) => row.dataSourceId === "a-mid")?.selected,
    ).toBe(false);
    expect(result.stats.suppressedAsDuplicates).toBe(1);
  });
});
