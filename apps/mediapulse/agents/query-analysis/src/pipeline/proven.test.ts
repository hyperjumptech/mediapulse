import { describe, expect, it } from "vitest";

import { provenCandidates } from "./proven";

describe("provenCandidates", () => {
  it("keeps proven phrasings in strength order", () => {
    const result = provenCandidates([
      {
        text: "Kideco produksi batu bara",
        intent: "dealsAndMovements",
        novelArticleCount: 9,
      },
      {
        text: "harga batu bara acuan",
        intent: "industryPulse",
        novelArticleCount: 5,
      },
    ]);

    expect(result.map((candidate) => candidate.text)).toEqual([
      "Kideco produksi batu bara",
      "harga batu bara acuan",
    ]);
    expect(result[0]?.intent).toBe("dealsAndMovements");
  });

  it("drops a proven query that has since become perishable", () => {
    const result = provenCandidates([
      {
        text: "promo Kopi Kenangan 17 Agustus 2026",
        intent: "competitiveLandscape",
        novelArticleCount: 12,
      },
      {
        text: "aplikasi pengantaran kopi di Indonesia",
        intent: "disruptorsOrTech",
        novelArticleCount: 3,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("aplikasi pengantaran kopi di Indonesia");
  });

  it("labels phrasing language so the language mix still applies", () => {
    const result = provenCandidates([
      {
        text: "pertumbuhan kredit perbankan nasional",
        intent: "industryPulse",
        novelArticleCount: 4,
      },
      {
        text: "Indonesian coal export outlook",
        intent: "industryPulse",
        novelArticleCount: 2,
      },
    ]);

    expect(result[0]?.language).toBe("id");
    expect(result[1]?.language).toBe("en");
  });

  it("returns nothing when there is no history", () => {
    expect(provenCandidates([])).toEqual([]);
  });
});
