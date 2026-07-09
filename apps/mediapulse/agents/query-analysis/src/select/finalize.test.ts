/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { ProbedCandidate, ProbeSurvivor } from "../probe/yield-probe";
import { finalizeQueries } from "./finalize";

const survivor = (
  text: string,
  intent: ProbeSurvivor["intent"],
  hits: number,
  language: ProbeSurvivor["language"] = "id",
  rank = 1,
): ProbeSurvivor => ({ text, intent, language, hits, rank });

const dropped = (
  text: string,
  intent: ProbedCandidate["intent"],
  language: ProbedCandidate["language"] = "id",
): ProbedCandidate => ({ text, intent, language, hits: 0 });

describe("finalizeQueries", () => {
  it("backfills each intent to the floor from dropped candidates despite low yield", () => {
    const survivors = Array.from({ length: 10 }, (_unused, index) =>
      survivor(`macro ${index}`, "macro", 100 - index),
    );
    const droppedCompetitors = Array.from({ length: 5 }, (_unused, index) =>
      dropped(`competitor ${index}`, "competitor"),
    );

    const result = finalizeQueries({
      survivors,
      dropped: droppedCompetitors,
      queryCount: 55,
      perIntentFloor: 5,
      perIntentMax: 8,
    });

    const competitorCount = result.queries.filter(
      (query) => query.intent === "competitor",
    ).length;
    const macroCount = result.queries.filter(
      (query) => query.intent === "macro",
    ).length;

    expect(competitorCount).toBe(5);
    expect(macroCount).toBe(8);
    expect(result.reinstated).toEqual(
      expect.arrayContaining([
        "competitor 0",
        "competitor 1",
        "competitor 2",
        "competitor 3",
        "competitor 4",
      ]),
    );
  });

  it("caps any single intent at perIntentMax so it cannot crowd out others", () => {
    const survivors = [
      ...Array.from({ length: 12 }, (_unused, index) =>
        survivor(`macro ${index}`, "macro", 100 - index),
      ),
      ...Array.from({ length: 6 }, (_unused, index) =>
        survivor(`comp ${index}`, "competitor", 50 - index),
      ),
    ];

    const result = finalizeQueries({
      survivors,
      dropped: [],
      queryCount: 55,
      perIntentFloor: 5,
      perIntentMax: 8,
    });

    const macroCount = result.queries.filter(
      (query) => query.intent === "macro",
    ).length;
    const competitorCount = result.queries.filter(
      (query) => query.intent === "competitor",
    ).length;

    expect(macroCount).toBe(8);
    expect(competitorCount).toBe(6);
  });

  it("returns an empty set when there is nothing to finalize", () => {
    const result = finalizeQueries({
      survivors: [],
      dropped: [],
      queryCount: 24,
      perIntentFloor: 5,
      perIntentMax: 8,
    });
    expect(result.queries).toEqual([]);
  });

  it("ranks survivors by hits and truncates to queryCount", () => {
    const result = finalizeQueries({
      survivors: [
        survivor("a", "competitor", 2),
        survivor("b", "competitor", 9),
        survivor("c", "competitor", 5),
      ],
      dropped: [],
      queryCount: 2,
      perIntentFloor: 5,
      perIntentMax: 8,
    });

    expect(result.queries.map((q) => q.text)).toEqual(["b", "c"]);
    expect(result.queries.map((q) => q.rank)).toEqual([1, 2]);
  });

  it("reinstates a dropped candidate for a starved dedicated section", () => {
    const result = finalizeQueries({
      survivors: [survivor("industry theme", "industry_trend", 4)],
      dropped: [
        dropped("Bank Mandiri", "competitor"),
        dropped("OJK", "regulatory"),
      ],
      queryCount: 24,
      perIntentFloor: 5,
      perIntentMax: 8,
    });

    const texts = result.queries.map((q) => q.text);
    expect(texts).toContain("Bank Mandiri");
    expect(texts).toContain("OJK");
    expect(result.reinstated).toEqual(
      expect.arrayContaining(["Bank Mandiri", "OJK"]),
    );
  });

  it("falls back to dropped candidates when nothing yielded and no section was reinstated", () => {
    const result = finalizeQueries({
      survivors: [],
      dropped: [
        dropped("harga biji kopi", "supply_chain"),
        dropped("inflasi Indonesia", "macro", "en"),
      ],
      queryCount: 24,
      perIntentFloor: 5,
      perIntentMax: 8,
    });

    expect(result.queries.map((q) => q.text).sort()).toEqual([
      "harga biji kopi",
      "inflasi Indonesia",
    ]);
  });

  it("keeps an id/en mix when both languages are available", () => {
    const result = finalizeQueries({
      survivors: [
        survivor("id one", "competitor", 9, "id"),
        survivor("id two", "competitor", 8, "id"),
        survivor("en one", "competitor", 1, "en"),
      ],
      dropped: [],
      queryCount: 2,
      perIntentFloor: 5,
      perIntentMax: 8,
    });

    const languages = new Set(
      result.queries.map((q) => (q.text.startsWith("en") ? "en" : "id")),
    );
    expect(languages.has("id")).toBe(true);
    expect(languages.has("en")).toBe(true);
    expect(result.idCount + result.globalCount).toBe(result.queries.length);
  });

  it("reports per-intent and per-section counts", () => {
    const result = finalizeQueries({
      survivors: [
        survivor("comp", "competitor", 5),
        survivor("reg", "regulatory", 4),
      ],
      dropped: [],
      queryCount: 24,
      perIntentFloor: 5,
      perIntentMax: 8,
    });

    expect(result.perIntent.competitor).toBe(1);
    expect(result.perSection.competitiveLandscape).toBe(1);
    expect(result.perSection.regulatoryPolicyWatch).toBe(1);
  });
});
