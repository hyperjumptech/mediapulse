import { describe, expect, it } from "vitest";

import { properNounPhrases, ungroundedEntities } from "./entities-grounded.js";

describe("properNounPhrases", () => {
  it("keeps a multi-word name together", () => {
    expect(
      properNounPhrases("The lender said Bank Central Asia led the market."),
    ).toContain("Bank Central Asia");
  });

  it("skips the word that opens a sentence", () => {
    expect(
      properNounPhrases("Earthquake damage was reported across the province."),
    ).toStrictEqual([]);
  });

  it("skips the opening word of each sentence, not only the first", () => {
    const phrases = properNounPhrases(
      "Komdigi is monitoring recovery. Recovery continues across the region.",
    );

    expect(phrases).toStrictEqual([]);
  });

  it("collects names that appear after the opening word", () => {
    const phrases = properNounPhrases(
      "The outage hit Telkomsel, XLsmart, and Indosat in NTT.",
    );

    expect(phrases).toStrictEqual(["Telkomsel", "XLsmart", "Indosat", "NTT"]);
  });
});

describe("ungroundedEntities", () => {
  const kompasTitle =
    "Gempa NTT: 200 BTS Terdampak, Komdigi Pantau Pemulihan Jaringan Komunikasi";

  it("flags operators the article's own title never names", () => {
    const point =
      "Earthquake magnitude 7.7 in Flores disrupted 200 BTS from Telkomsel, XLsmart, and Indosat in NTT";

    expect(ungroundedEntities(point, kompasTitle)).toStrictEqual([
      "Flores",
      "Telkomsel",
      "XLsmart",
      "Indosat",
    ]);
  });

  it("keeps a point whose only name is in the title", () => {
    const point =
      "Komdigi is monitoring the recovery of communication networks";

    expect(ungroundedEntities(point, kompasTitle)).toStrictEqual([]);
  });

  it("treats a headline abbreviation as its expansion", () => {
    const point = "The regulator said Bank Indonesia launched the scheme";

    expect(
      ungroundedEntities(point, "BI Luncurkan Kartu Kredit Indonesia"),
    ).toStrictEqual([]);
  });

  it("treats an abbreviation in the point as the title's expansion", () => {
    const point = "The report said BI would keep the rate unchanged";

    expect(
      ungroundedEntities(point, "Bank Indonesia Tahan Suku Bunga Acuan"),
    ).toStrictEqual([]);
  });

  it("grounds a name the title carries inside a longer phrase", () => {
    const point = "The bank said Telkom would expand its enterprise segment";

    expect(
      ungroundedEntities(point, "Telkom Indonesia Genjot Bisnis Enterprise"),
    ).toStrictEqual([]);
  });

  it("grounds an English rendering of an Indonesian headline name", () => {
    const point =
      "The central bank said Bank Indonesia launched the Indonesian Credit Card";

    expect(
      ungroundedEntities(point, "BI Luncurkan Kartu Kredit Indonesia"),
    ).toStrictEqual([]);
  });

  it("still flags a name sharing no word with the title", () => {
    const point = "The outage hit Smartfren across Makassar";

    expect(
      ungroundedEntities(
        point,
        "Gempa NTT: 200 BTS Terdampak, Komdigi Pantau Pemulihan",
      ),
    ).toStrictEqual(["Smartfren", "Makassar"]);
  });

  it("returns nothing for a point asserting no name", () => {
    expect(
      ungroundedEntities("Revenue grew over the period", kompasTitle),
    ).toStrictEqual([]);
  });
});
