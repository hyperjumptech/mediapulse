/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  normalizeEntityName,
  textNamesEntity,
  textNamesMarketParties,
  textNamesMarketParty,
  type MarketPartyMatch,
  type MarketPartyProfile,
} from "./market-party-names.js";

const context = (
  competitors: { name: string; aliases: string[] }[],
  regulators: { name: string; aliases: string[] }[] = [],
): MarketPartyProfile => ({ competitors, regulators });

const fore = context(
  [
    { name: "Kopi Kenangan", aliases: ["Kopi Kenangan"] },
    { name: "Tomoro Coffee", aliases: ["Tomoro"] },
  ],
  [
    {
      name: "National Agency of Drug and Food Control",
      aliases: ["BPOM", "Badan POM"],
    },
  ],
);

describe("textNamesMarketParty", () => {
  it("finds a regulator named only by its alias", () => {
    const match = textNamesMarketParty(
      "Batas BPA Dipangkas Drastis 12 Kali Lipat, BPOM Perketat Aturan Galon Guna Ulang",
      fore,
    );

    expect(match).toStrictEqual({
      kind: "regulator",
      name: "National Agency of Drug and Food Control",
      surfaceForm: "BPOM",
    });
  });

  it("finds a competitor named by its alias", () => {
    const match = textNamesMarketParty(
      "TOMORO COFFEE Collaborates with Muhammad Aga to Launch a New Series",
      fore,
    );

    expect(match).toStrictEqual({
      kind: "competitor",
      name: "Tomoro Coffee",
      surfaceForm: "Tomoro",
    });
  });

  it("finds a competitor by the brand token of its registered name", () => {
    const mora = context([
      { name: "Telkom Indonesia (Persero)", aliases: ["TLKM"] },
    ]);

    const match = textNamesMarketParty(
      "BATIC 2026: Telkom Pacu Transformasi di Era AI",
      mora,
    );

    expect(match).toStrictEqual({
      kind: "competitor",
      name: "Telkom Indonesia (Persero)",
      surfaceForm: "Telkom",
    });
  });

  it("does not match an ordinary Indonesian word inside a company name", () => {
    const match = textNamesMarketParty(
      "Intip Booth Pertamina di IndoEBTKE ConEx 2026, Ada Kopi Geothermal",
      fore,
    );

    expect(match).toBeNull();
  });

  it("does not match a symbol-like alias as an English word", () => {
    const aman = context([
      { name: "Bekasi Fajar Industrial Estate", aliases: ["BEST"] },
    ]);

    const match = textNamesMarketParty(
      "The best industrial policy for the year ahead",
      aman,
    );

    expect(match).toBeNull();
  });

  it("does not match a generic token shared by many company names", () => {
    const bmri = context([
      { name: "Bank Negara Indonesia (Persero)", aliases: ["BBNI"] },
    ]);

    const match = textNamesMarketParty(
      "Industri perbankan nasional tumbuh di Indonesia",
      bmri,
    );

    expect(match).toBeNull();
  });

  it("returns null without issuer context", () => {
    expect(textNamesMarketParty("Anything at all", null)).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(textNamesMarketParty("   ", fore)).toBeNull();
  });
});

describe("textNamesMarketParties", () => {
  it("returns every party the text names, not only the first", () => {
    const matches = textNamesMarketParties(
      "Kopi Kenangan dan Tomoro sama-sama menunggu aturan baru BPOM",
      fore,
    );

    expect(matches.map((match: MarketPartyMatch) => match.name)).toStrictEqual([
      "Kopi Kenangan",
      "Tomoro Coffee",
      "National Agency of Drug and Food Control",
    ]);
  });

  it("reports a party once however many of its spellings the text carries", () => {
    const mapi = context([
      { name: "Mitra Adiperkasa", aliases: ["MAPI", "Starbucks"] },
    ]);

    const matches = textNamesMarketParties(
      "Starbucks, yang dioperasikan MAPI, membuka gerai baru",
      mapi,
    );

    expect(matches).toStrictEqual([
      {
        kind: "competitor",
        name: "Mitra Adiperkasa",
        surfaceForm: "MAPI",
      },
    ]);
  });

  it("returns nothing for an empty text", () => {
    expect(textNamesMarketParties("   ", fore)).toStrictEqual([]);
  });
});

describe("normalizeEntityName", () => {
  it("normalises two spellings of one company alike", () => {
    const withLegalForm = normalizeEntityName("PT Fore Kopi Indonesia Tbk");
    const withoutLegalForm = normalizeEntityName("Fore Kopi Indonesia");

    expect(withLegalForm).toBe("fore kopi indonesia");
    expect(withoutLegalForm).toBe("fore kopi indonesia");
  });

  it("drops case, punctuation and diacritics", () => {
    expect(normalizeEntityName("Télkom Indonesia (Persero)")).toBe(
      "telkom indonesia",
    );
  });

  it("returns an empty string for a name carrying nothing distinctive", () => {
    expect(normalizeEntityName("PT Tbk")).toBe("");
  });
});

describe("textNamesEntity", () => {
  it("matches a name as a whole word", () => {
    expect(textNamesEntity("Gerai Starbucks di Jakarta", "Starbucks")).toBe(
      true,
    );
  });

  it("does not match a name the text only contains as a fragment", () => {
    expect(textNamesEntity("Kopi Kenangan buka gerai", "Kopi Ken")).toBe(false);
  });

  it("does not match a name the text never carries", () => {
    expect(textNamesEntity("Fore Coffee buka gerai", "Tomoro")).toBe(false);
  });
});
