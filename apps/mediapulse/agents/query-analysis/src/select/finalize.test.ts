/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { Candidate } from "../pipeline/types";
import { finalizeQueries } from "./finalize";

const candidate = (
  text: string,
  intent: Candidate["intent"],
  language: Candidate["language"] = "id",
): Candidate => ({ text, intent, language });

describe("finalizeQueries", () => {
  it("takes the first queriesPerIntent candidates for each intent in order", () => {
    const candidates = [
      ...Array.from({ length: 9 }, (_unused, index) =>
        candidate(`pulse ${index}`, "industryPulse"),
      ),
      ...Array.from({ length: 7 }, (_unused, index) =>
        candidate(`comp ${index}`, "competitiveLandscape"),
      ),
    ];

    const result = finalizeQueries({ candidates, queriesPerIntent: 5 });

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
    const candidates = [
      ...Array.from({ length: 12 }, (_unused, index) =>
        candidate(`pulse ${index}`, "industryPulse"),
      ),
      ...Array.from({ length: 12 }, (_unused, index) =>
        candidate(`deal ${index}`, "dealsAndMovements"),
      ),
    ];

    const result = finalizeQueries({ candidates, queriesPerIntent: 5 });

    expect(result.queries).toHaveLength(10);
  });

  it("dedupes candidates by normalized text across intents", () => {
    const result = finalizeQueries({
      candidates: [
        candidate("Bank Mandiri", "competitiveLandscape"),
        candidate("  bank   mandiri  ", "industryPulse"),
      ],
      queriesPerIntent: 5,
    });

    expect(result.queries).toHaveLength(1);
    expect(result.queries[0]?.text).toBe("Bank Mandiri");
  });

  it("returns an empty set when there is nothing to finalize", () => {
    const result = finalizeQueries({ candidates: [], queriesPerIntent: 5 });

    expect(result.queries).toEqual([]);
  });

  it("ranks the persisted queries in generation order", () => {
    const result = finalizeQueries({
      candidates: [
        candidate("a", "competitiveLandscape"),
        candidate("b", "competitiveLandscape"),
        candidate("c", "competitiveLandscape"),
      ],
      queriesPerIntent: 5,
    });

    expect(result.queries.map((query) => query.text)).toEqual(["a", "b", "c"]);
    expect(result.queries.map((query) => query.rank)).toEqual([1, 2, 3]);
  });

  it("keeps an id/en mix when both languages are available", () => {
    const result = finalizeQueries({
      candidates: [
        candidate("id one", "competitiveLandscape", "id"),
        candidate("id two", "competitiveLandscape", "id"),
        candidate("id three", "competitiveLandscape", "id"),
        candidate("id four", "competitiveLandscape", "id"),
        candidate("id five", "competitiveLandscape", "id"),
        candidate("en one", "competitiveLandscape", "en"),
      ],
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
      candidates: [
        candidate("comp", "competitiveLandscape"),
        candidate("reg", "regulatoryPolicyWatch"),
      ],
      queriesPerIntent: 5,
    });

    expect(result.perIntent.competitiveLandscape).toBe(1);
    expect(result.perSection.competitiveLandscape).toBe(1);
    expect(result.perSection.regulatoryPolicyWatch).toBe(1);
  });

  it("always reports zero coverage for quickHits", () => {
    const result = finalizeQueries({
      candidates: [candidate("comp", "competitiveLandscape")],
      queriesPerIntent: 5,
    });

    expect(result.perSection.quickHits).toBe(0);
  });
});

describe("finalizeQueries vague-query demotion", () => {
  const subject = {
    symbol: "MAPI",
    name: "PT Mitra Adiperkasa Tbk",
    aliases: [],
    sectorTerms: ["Ritel Khusus"],
  };

  it("drops a bare symbol and a themeless phrase out of the budget", () => {
    const result = finalizeQueries({
      candidates: [
        { text: "MAPI", intent: "industryPulse", language: "en" },
        {
          text: "Cultural Resurgence",
          intent: "industryPulse",
          language: "en",
        },
        {
          text: "PT Mitra Adiperkasa Tbk industry trend",
          intent: "industryPulse",
          language: "en",
        },
        {
          text: "ritel pakaian Indonesia konsolidasi",
          intent: "industryPulse",
          language: "id",
        },
      ],
      queriesPerIntent: 2,
      subject,
    });

    expect(result.queries.map((query) => query.text)).toStrictEqual([
      "PT Mitra Adiperkasa Tbk industry trend",
      "ritel pakaian Indonesia konsolidasi",
    ]);
  });

  it("still fills the budget when every candidate is vague", () => {
    const result = finalizeQueries({
      candidates: [
        { text: "MAPI", intent: "industryPulse", language: "en" },
        { text: "Cultural Titans", intent: "industryPulse", language: "en" },
      ],
      queriesPerIntent: 2,
      subject,
    });

    expect(result.queries).toHaveLength(2);
  });

  it("changes nothing when no subject is supplied", () => {
    const result = finalizeQueries({
      candidates: [
        { text: "MAPI", intent: "industryPulse", language: "en" },
        {
          text: "PT Mitra Adiperkasa Tbk deals",
          intent: "industryPulse",
          language: "en",
        },
      ],
      queriesPerIntent: 1,
    });

    expect(result.queries[0]?.text).toBe("MAPI");
  });
});
