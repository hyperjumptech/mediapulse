/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { isVagueQuery, type QuerySubject } from "./specificity";

const mapi: QuerySubject = {
  symbol: "MAPI",
  name: "PT Mitra Adiperkasa Tbk",
  aliases: ["MAP"],
  sectorTerms: ["Ritel Khusus", "Ritel Pakaian & Tekstil", "Perdagangan Umum"],
};

describe("isVagueQuery", () => {
  it.each([
    "MAPI",
    "Cultural Resurgence",
    "Cultural Titans",
    "Contrarian Signals",
  ])("flags %s", (text) => {
    expect(isVagueQuery(text, mapi)).toBe(true);
  });

  it.each([
    "PT Mitra Adiperkasa Tbk",
    "MAPI acquisition",
    "saham MAPI target harga",
    "Adiperkasa gerai baru",
    "ritel pakaian Indonesia konsolidasi",
    "Indonesia consumer spending retail demand",
  ])("keeps %s", (text) => {
    expect(isVagueQuery(text, mapi)).toBe(false);
  });

  it("does not treat a generic name token as an anchor on its own", () => {
    expect(isVagueQuery("mitra strategis global", mapi)).toBe(true);
  });

  it("treats an empty query as vague", () => {
    expect(isVagueQuery("   ", mapi)).toBe(true);
  });
});
