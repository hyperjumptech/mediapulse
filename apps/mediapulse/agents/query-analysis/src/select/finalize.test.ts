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
  it("takes the top queriesPerIntent by hits for each intent", () => {
    const survivors = [
      ...Array.from({ length: 9 }, (_unused, index) =>
        survivor(`pulse ${index}`, "industryPulse", 100 - index),
      ),
      ...Array.from({ length: 7 }, (_unused, index) =>
        survivor(`comp ${index}`, "competitiveLandscape", 50 - index),
      ),
    ];

    const result = finalizeQueries({
      survivors,
      dropped: [],
      queriesPerIntent: 5,
    });

    const pulseQueries = result.queries.filter(
      (query) => query.intent === "industryPulse",
    );
    const competitiveQueries = result.queries.filter(
      (query) => query.intent === "competitiveLandscape",
    );

    expect(pulseQueries).toHaveLength(5);
    expect(competitiveQueries).toHaveLength(5);
    expect(pulseQueries.map((query) => query.text)).toEqual([
      "pulse 0",
      "pulse 1",
      "pulse 2",
      "pulse 3",
      "pulse 4",
    ]);
  });

  it("caps the total at queriesPerIntent times the number of intents present", () => {
    const survivors = [
      ...Array.from({ length: 12 }, (_unused, index) =>
        survivor(`pulse ${index}`, "industryPulse", 100 - index),
      ),
      ...Array.from({ length: 12 }, (_unused, index) =>
        survivor(`deal ${index}`, "dealsAndMovements", 50 - index),
      ),
    ];

    const result = finalizeQueries({
      survivors,
      dropped: [],
      queriesPerIntent: 5,
    });

    expect(result.queries).toHaveLength(10);
  });

  it("fills an intent from probe-dropped candidates when nothing it generated yielded", () => {
    const survivors = Array.from({ length: 8 }, (_unused, index) =>
      survivor(`pulse ${index}`, "industryPulse", 100 - index),
    );
    const droppedCompetitors = Array.from({ length: 5 }, (_unused, index) =>
      dropped(`competitor ${index}`, "competitiveLandscape"),
    );

    const result = finalizeQueries({
      survivors,
      dropped: droppedCompetitors,
      queriesPerIntent: 5,
    });

    const competitiveCount = result.queries.filter(
      (query) => query.intent === "competitiveLandscape",
    ).length;

    expect(competitiveCount).toBe(5);
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

  it("reinstates dropped candidates for otherwise starved sections", () => {
    const result = finalizeQueries({
      survivors: [survivor("industry theme", "industryPulse", 4)],
      dropped: [
        dropped("Bank Mandiri", "competitiveLandscape"),
        dropped("OJK", "regulatoryPolicyWatch"),
      ],
      queriesPerIntent: 5,
    });

    const texts = result.queries.map((query) => query.text);

    expect(texts).toContain("Bank Mandiri");
    expect(texts).toContain("OJK");
    expect(result.reinstated).toEqual(
      expect.arrayContaining(["Bank Mandiri", "OJK"]),
    );
  });

  it("dedupes candidates by normalized text across intents", () => {
    const result = finalizeQueries({
      survivors: [
        survivor("Bank Mandiri", "competitiveLandscape", 9),
        survivor("  bank   mandiri  ", "industryPulse", 3),
      ],
      dropped: [],
      queriesPerIntent: 5,
    });

    expect(result.queries).toHaveLength(1);
    expect(result.queries[0]?.text).toBe("Bank Mandiri");
  });

  it("returns an empty set when there is nothing to finalize", () => {
    const result = finalizeQueries({
      survivors: [],
      dropped: [],
      queriesPerIntent: 5,
    });

    expect(result.queries).toEqual([]);
  });

  it("ranks the persisted queries by hits", () => {
    const result = finalizeQueries({
      survivors: [
        survivor("a", "competitiveLandscape", 2),
        survivor("b", "competitiveLandscape", 9),
        survivor("c", "competitiveLandscape", 5),
      ],
      dropped: [],
      queriesPerIntent: 5,
    });

    expect(result.queries.map((query) => query.text)).toEqual(["b", "c", "a"]);
    expect(result.queries.map((query) => query.rank)).toEqual([1, 2, 3]);
  });

  it("falls back to dropped candidates when nothing yielded", () => {
    const result = finalizeQueries({
      survivors: [],
      dropped: [
        dropped("harga biji kopi", "industryPulse"),
        dropped("inflasi Indonesia", "industryPulse", "en"),
      ],
      queriesPerIntent: 5,
    });

    expect(result.queries.map((query) => query.text).sort()).toEqual([
      "harga biji kopi",
      "inflasi Indonesia",
    ]);
  });

  it("keeps an id/en mix when both languages are available", () => {
    const result = finalizeQueries({
      survivors: [
        survivor("id one", "competitiveLandscape", 9, "id"),
        survivor("id two", "competitiveLandscape", 8, "id"),
        survivor("id three", "competitiveLandscape", 7, "id"),
        survivor("id four", "competitiveLandscape", 6, "id"),
        survivor("id five", "competitiveLandscape", 5, "id"),
        survivor("en one", "competitiveLandscape", 1, "en"),
      ],
      dropped: [],
      queriesPerIntent: 5,
    });

    const languages = new Set(
      result.queries.map((query) =>
        query.text.startsWith("en") ? "en" : "id",
      ),
    );

    expect(languages.has("id")).toBe(true);
    expect(languages.has("en")).toBe(true);
    expect(result.idCount + result.globalCount).toBe(result.queries.length);
  });

  it("reports per-intent and per-section counts", () => {
    const result = finalizeQueries({
      survivors: [
        survivor("comp", "competitiveLandscape", 5),
        survivor("reg", "regulatoryPolicyWatch", 4),
      ],
      dropped: [],
      queriesPerIntent: 5,
    });

    expect(result.perIntent.competitiveLandscape).toBe(1);
    expect(result.perSection.competitiveLandscape).toBe(1);
    expect(result.perSection.regulatoryPolicyWatch).toBe(1);
  });

  it("always reports zero coverage for quickHits", () => {
    const result = finalizeQueries({
      survivors: [survivor("comp", "competitiveLandscape", 5)],
      dropped: [],
      queriesPerIntent: 5,
    });

    expect(result.perSection.quickHits).toBe(0);
  });
});
