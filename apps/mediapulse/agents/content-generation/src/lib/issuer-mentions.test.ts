import { describe, expect, it } from "vitest";

import {
  issuerMentions,
  issuerNamesFrom,
  mentionsIssuer,
} from "./issuer-mentions.js";

describe("issuerNamesFrom", () => {
  it("collects the symbol, the name, and the curated aliases once each", () => {
    // Setup
    const names = issuerNamesFrom({
      symbol: "DSSA",
      name: "Dian Swastatika Sentosa Tbk",
      aliases: [
        "DSSA",
        "Sinarmas Energy",
        "Dian Swastatika",
        "PT Dian Swastatika Sentosa Tbk",
      ],
    });

    // Assert
    expect(names).toEqual([
      "DSSA",
      "Dian Swastatika Sentosa Tbk",
      "Sinarmas Energy",
      "Dian Swastatika",
      "PT Dian Swastatika Sentosa Tbk",
    ]);
  });

  it("drops a single-word name too short to identify anything", () => {
    // Setup
    const names = issuerNamesFrom({ symbol: "AB", name: "AB Holdings Tbk" });

    // Assert
    expect(names).toEqual(["AB Holdings Tbk"]);
  });

  it("returns nothing when the issuer has no usable name", () => {
    // Setup
    const names = issuerNamesFrom({ symbol: "  ", aliases: [] });

    // Assert
    expect(names).toEqual([]);
  });
});

describe("issuerMentions", () => {
  it("finds the issuer inside a multi-company feature", () => {
    // Setup
    const article =
      "Melalui salah satu pilar usahanya, PT Dian Swastatika Sentosa Tbk (DSSA), " +
      "perseroan berekspansi dari sebelumnya bisnis di sektor migas ke infrastruktur digital.";
    const names = issuerNamesFrom({
      symbol: "DSSA",
      name: "Dian Swastatika Sentosa Tbk",
      aliases: ["Dian Swastatika"],
    });

    // Assert
    expect(issuerMentions(article, names)).toContain("DSSA");
    expect(issuerMentions(article, names)).toContain("Dian Swastatika");
  });

  it("matches an all-caps symbol only when the text writes it in caps", () => {
    // Setup
    const names = issuerNamesFrom({ symbol: "WIFI" });

    // Assert
    expect(mentionsIssuer("Pelanggan mengeluh soal wifi kantor.", names)).toBe(
      false,
    );
    expect(mentionsIssuer("WIFI membukukan laba bersih.", names)).toBe(true);
  });

  it("matches a mixed-case name whatever case the text uses", () => {
    // Setup
    const names = issuerNamesFrom({ name: "Dian Swastatika Sentosa Tbk" });

    // Assert
    expect(mentionsIssuer("dian swastatika sentosa tbk naik", names)).toBe(
      true,
    );
  });

  it("tolerates a line break between the words of a name", () => {
    // Setup
    const names = issuerNamesFrom({ name: "DCI Indonesia" });

    // Assert
    expect(mentionsIssuer("PT DCI\nIndonesia Tbk", names)).toBe(true);
  });

  it("refuses a name buried inside a longer word", () => {
    // Setup
    const names = issuerNamesFrom({ symbol: "DCI" });

    // Assert
    expect(mentionsIssuer("Perusahaan DCIX mengumumkan ekspansi.", names)).toBe(
      false,
    );
  });

  it("reports no mention when the article never names the issuer", () => {
    // Setup
    const names = issuerNamesFrom({ symbol: "DSSA", name: "Dian Swastatika" });

    // Assert
    expect(issuerMentions("RAIA Grid diluncurkan oleh IFT.", names)).toEqual(
      [],
    );
  });
});
