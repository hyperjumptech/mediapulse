/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { DEFAULT_SCORE_CONFIG, scoreArticles } from "./score-articles";

describe("scoreArticles", () => {
  it("returns empty list for zero articles", () => {
    // Setup
    const input = {
      articles: [],
      tickerAliases: ["BBCA", "Bank Central Asia"],
      existingEntityNames: [],
      config: DEFAULT_SCORE_CONFIG,
      now: new Date("2026-03-19T00:00:00.000Z"),
    };

    // Act
    const result = scoreArticles(input);

    // Assert
    expect(result).toEqual([]);
  });

  it("applies threshold and maxSelected when selecting", () => {
    // Setup
    const now = new Date("2026-03-19T00:00:00.000Z");
    const result = scoreArticles({
      articles: [
        {
          dataSourceId: "a1",
          title: "BBCA reports strong earnings",
          content: "Bank Central Asia posted growth and OJK comments.",
          url: "https://reuters.com/a1",
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
          extractedEntityNames: ["Bank Central Asia", "OJK"],
        },
        {
          dataSourceId: "a2",
          title: "Macro update unrelated to company",
          content: "General macroeconomic update",
          url: "https://example.com/a2",
          createdAt: new Date("2026-03-14T00:00:00.000Z"),
          extractedEntityNames: [],
        },
      ],
      tickerAliases: ["BBCA", "Bank Central Asia"],
      existingEntityNames: ["Bank Central Asia", "OJK"],
      config: {
        ...DEFAULT_SCORE_CONFIG,
        maxSelected: 1,
        minScoreThreshold: 0.5,
      },
      now,
    });

    // Act
    const selected = result.filter((row) => row.selected);

    // Assert
    expect(selected).toHaveLength(1);
    expect(selected[0]?.dataSourceId).toBe("a1");
    expect(result.find((row) => row.dataSourceId === "a2")?.selected).toBe(
      false,
    );
  });

  it("penalizes novelty for near-duplicate second item", () => {
    // Setup
    const result = scoreArticles({
      articles: [
        {
          dataSourceId: "b1",
          title: "BBCA Q1 earnings jump on loan growth",
          content: "BBCA reported earnings growth this quarter.",
          url: "https://bisnis.com/b1",
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
          extractedEntityNames: ["BBCA"],
        },
        {
          dataSourceId: "b2",
          title: "BBCA earnings jump in Q1 on loan growth",
          content: "Very similar earnings article.",
          url: "https://bisnis.com/b2",
          createdAt: new Date("2026-03-19T00:00:00.000Z"),
          extractedEntityNames: ["BBCA"],
        },
      ],
      tickerAliases: ["BBCA", "Bank Central Asia"],
      existingEntityNames: ["BBCA"],
      config: {
        ...DEFAULT_SCORE_CONFIG,
        maxSelected: 2,
        minScoreThreshold: 0,
      },
      now: new Date("2026-03-19T00:00:00.000Z"),
    });

    // Act
    const first = result.find((row) => row.dataSourceId === "b1");
    const second = result.find((row) => row.dataSourceId === "b2");

    // Assert
    expect(first?.scoreBreakdown.novelty).toBe(1);
    expect(second?.scoreBreakdown.novelty).toBe(0.2);
    expect((first?.score ?? 0) > (second?.score ?? 0)).toBe(true);
  });

  it("breaks score ties deterministically by dataSourceId", () => {
    // Setup
    const result = scoreArticles({
      articles: [
        {
          dataSourceId: "z-last",
          title: "General market update one",
          content: "No alias, no overlap",
          url: "https://example.com/1",
          createdAt: new Date("2026-03-14T00:00:00.000Z"),
          extractedEntityNames: [],
        },
        {
          dataSourceId: "a-first",
          title: "General market update two",
          content: "No alias, no overlap",
          url: "https://example.com/2",
          createdAt: new Date("2026-03-14T00:00:00.000Z"),
          extractedEntityNames: [],
        },
      ],
      tickerAliases: [],
      existingEntityNames: [],
      config: {
        ...DEFAULT_SCORE_CONFIG,
        minScoreThreshold: 0,
      },
      now: new Date("2026-03-19T00:00:00.000Z"),
    });

    // Act
    const orderedIds = result.map((row) => row.dataSourceId);

    // Assert
    expect(orderedIds).toEqual(["a-first", "z-last"]);
  });
});
