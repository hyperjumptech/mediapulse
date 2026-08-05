import { describe, expect, it } from "vitest";

import { dropRepeatedClaims, figureKeys } from "./repeated-claim-dedup.js";

describe("figureKeys", () => {
  it("collapses the same amount written in English and Indonesian scale words", () => {
    const english = figureKeys("Revenue reached Rp75.9 trillion in H1 2026.");
    const indonesian = figureKeys("Pendapatan mencapai Rp75,9 triliun.");

    expect(english.has("75.9t")).toBe(true);
    expect(indonesian.has("75.9t")).toBe(true);
  });

  it("keeps percentages distinct from bare numbers", () => {
    const keys = figureKeys("EBITDA rose 54% to $168 million.");

    expect(keys.has("54%")).toBe(true);
    expect(keys.has("168m")).toBe(true);
  });

  it("ignores single digits, which carry no identity", () => {
    expect(figureKeys("Three new stores opened, 1 of them abroad.").size).toBe(
      0,
    );
  });
});

describe("dropRepeatedClaims", () => {
  it("drops TLKM's half-year revenue after its first telling", () => {
    const result = dropRepeatedClaims([
      "Telkom Indonesia posts Rp75.9 trillion revenue, up 3.9% year-on-year in H1 2026",
      "B2B Infrastructure revenue grows 19%, Telkomsel's digital business data jumps 11%",
      "Telkom's consolidated revenue rose 3.9% to Rp 75.9 trillion in H1 2026",
    ]);

    expect(result.points).toEqual([
      "Telkom Indonesia posts Rp75.9 trillion revenue, up 3.9% year-on-year in H1 2026",
      "B2B Infrastructure revenue grows 19%, Telkomsel's digital business data jumps 11%",
    ]);
    expect(result.dropped).toHaveLength(1);
  });

  it("drops Grab's EBITDA and buyback when each is stated twice", () => {
    const result = dropRepeatedClaims([
      "Adjusted EBITDA rises 54% YoY to $168 million, 18th profitable quarter",
      "Grab announced $750 million share buyback and plans Foodpanda Taiwan acquisition",
      "Grab Holdings' Q2 2026 adjusted EBITDA rose 54% to $168 million",
      "Grab Holdings will repurchase up to $750 million of its outstanding shares",
    ]);

    expect(result.dropped).toHaveLength(2);
    expect(result.points).toHaveLength(2);
  });

  it("keeps two different facts that happen to share a number", () => {
    const result = dropRepeatedClaims([
      "Ferronickel sales surged 32% to 7,605 tons in H1 2026.",
      "Bank Danamon net profit grew 32% on stronger lending margins.",
    ]);

    expect(result.dropped).toEqual([]);
  });

  it("keeps distinct figures from the same company", () => {
    const result = dropRepeatedClaims([
      "ACES net profit rose 33.3% to Rp390.3 billion in H1 2026.",
      "ACES operating profit increased 32.3% to Rp509.8 billion.",
      "ACES net sales grew 6.3% to Rp4.5 trillion.",
    ]);

    expect(result.dropped).toEqual([]);
    expect(result.points).toHaveLength(3);
  });

  it("keeps points carrying no figure at all", () => {
    const result = dropRepeatedClaims([
      "Focus remains on product quality, fast service, and cleanliness.",
      "Management reiterated its expansion strategy for the year.",
    ]);

    expect(result.dropped).toEqual([]);
  });

  it("keeps the first telling and drops the later one", () => {
    const result = dropRepeatedClaims([
      "First telling: revenue reached Rp75.9 trillion in H1 2026.",
      "Second telling: revenue reached Rp75.9 trillion in H1 2026.",
    ]);

    expect(result.points).toEqual([
      "First telling: revenue reached Rp75.9 trillion in H1 2026.",
    ]);
  });
});
