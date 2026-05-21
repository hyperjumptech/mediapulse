/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { PerSourceRelevanceSignals } from "../analysis-relevance-scoring.js";
import {
  buildEntityNamesForDiversification,
  entitySetForRow,
  jaccardOverlap,
  shingleOverlap,
  titleShingles,
} from "./selection-diversification.js";

const signalsFor = (
  rows: Array<{
    dataSourceId: string;
    entityNames: string[];
    titleLower: string;
  }>,
): PerSourceRelevanceSignals[] =>
  rows.map((row) => ({
    dataSourceId: row.dataSourceId,
    createdAt: new Date("2026-06-01T12:00:00Z"),
    entityCount: row.entityNames.length,
    relationCount: 0,
    mentionCount: 0,
    avgMentionConfidence: 0,
    titleLower: row.titleLower,
    textLower: "",
    entityNames: row.entityNames,
  }));

describe("entitySetForRow and jaccardOverlap", () => {
  it("includes canonical names and aliases and reaches 0.5 Jaccard at default threshold", () => {
    const entities = buildEntityNamesForDiversification(
      [
        {
          canonicalName: "Apple",
          aliases: ["Tim Cook", "iPhone"],
        },
      ],
      [],
    );
    expect(entities).toEqual(
      expect.arrayContaining(["apple", "tim cook", "iphone"]),
    );

    const perSource = signalsFor([
      {
        dataSourceId: "a",
        entityNames: entities,
        titleLower: "apple story",
      },
      {
        dataSourceId: "b",
        entityNames: buildEntityNamesForDiversification(
          [{ canonicalName: "Apple", aliases: ["Tim Cook", "Q2 Earnings"] }],
          [],
        ),
        titleLower: "apple earnings",
      },
    ]);

    const setA = entitySetForRow("a", perSource);
    const setB = entitySetForRow("b", perSource);
    expect(jaccardOverlap(setA, setB)).toBe(0.5);
  });
});

describe("titleShingles and shingleOverlap", () => {
  it("marks near-duplicate headlines as title-adjacent", () => {
    const shared = "apple beats q2 earnings estimates as services";
    const left = `${shared} grow`;
    const right = `${shared} expand`;
    expect(shingleOverlap(left, right)).toBeGreaterThanOrEqual(0.4);
    expect(
      shingleOverlap(
        "apple beats q2 earnings estimates as services grow",
        "apple beats q2 earnings estimates and services grow",
      ),
    ).toBeGreaterThan(0);
  });

  it("does not merge unrelated apple headlines", () => {
    const vision = "apple unveils vision pro";
    const earnings = "apple beats q2 earnings estimates";
    expect(shingleOverlap(vision, earnings)).toBeLessThan(0.4);
  });

  it("builds 4-word shingles from tokenized titles", () => {
    const shingles = titleShingles("one two three four five", 4);
    expect(shingles.has("one two three four")).toBe(true);
    expect(shingles.has("two three four five")).toBe(true);
    expect(shingles.size).toBe(2);
  });
});
