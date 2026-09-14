import { describe, expect, it } from "vitest";

import { pointsOmitStatedFigures } from "./material-figure-coverage.js";

const FIGURE_RICH_BODY =
  "Bisnis infrastruktur digital DSSA memberikan pendapatan 211,8 juta dolar AS pada 2025, " +
  "naik 47 persen. Pada kuartal pertama 2026 tercatat 69,1 juta dolar AS, melonjak 50 persen " +
  "dari 46,1 juta dolar AS. Kapasitas beban IT sekitar 40 MW.";

describe("pointsOmitStatedFigures", () => {
  it("flags the colour-only points shipped on 2026-09-13", () => {
    // Setup
    const points = [
      "Arsari Group founder Hashim Djojohadikusumo, who admitted to not using AI, launched RAIA Grid.",
    ];

    // Assert
    expect(pointsOmitStatedFigures(FIGURE_RICH_BODY, points)).toBe(true);
  });

  it("counts a capacity or a count, not only money and percentages", () => {
    // Setup
    const points = [
      "DCII operates nine data centres in five locations with 132 MW of shell capacity.",
    ];

    // Assert
    expect(pointsOmitStatedFigures(FIGURE_RICH_BODY, points)).toBe(false);
  });

  it("passes when one point carries a figure the body states", () => {
    // Setup
    const points = [
      "Hashim Djojohadikusumo said he does not use any AI model.",
      "DSSA's digital infrastructure business posted US$211.8 million of revenue in 2025.",
    ];

    // Assert
    expect(pointsOmitStatedFigures(FIGURE_RICH_BODY, points)).toBe(false);
  });

  it("leaves a figure-free article alone", () => {
    // Setup
    const body =
      "The ministry said it would form a team to draft the new oil and gas law " +
      "once the presidential letter arrives.";
    const points = [
      "The ministry awaits a presidential letter before drafting.",
    ];

    // Assert
    expect(pointsOmitStatedFigures(body, points)).toBe(false);
  });

  it("reports nothing for an empty point set, which other guards own", () => {
    // Assert
    expect(pointsOmitStatedFigures(FIGURE_RICH_BODY, [])).toBe(false);
  });
});
