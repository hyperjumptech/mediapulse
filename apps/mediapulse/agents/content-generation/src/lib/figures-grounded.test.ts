/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  citedFigures,
  figuresGrounded,
  ungroundedFigures,
} from "./figures-grounded.js";

describe("citedFigures", () => {
  it("lists the figure the 2026-08-12 BMRI item took from a description", () => {
    expect(
      citedFigures(
        "Foreign investors bought BRI shares with transaction value Rp 664.81 billion",
      ),
    ).toEqual([
      { kind: "currency", value: "66481" },
      { kind: "scaled", value: "66481" },
    ]);
  });

  it("returns nothing for a point asserting no figure", () => {
    expect(
      citedFigures("BRI targets mortgage growth at the Danantara expo"),
    ).toEqual([]);
  });
});

describe("ungroundedFigures", () => {
  it("flags the percentages the 2026-08-07 ERAA item invented", () => {
    const point =
      "Tender offer reduced MAPI's free float as investor share holdings fell from 40% to 20%";
    const source =
      "Porsi publik sebelumnya 49% atau sebanyak 8.134.000.000 saham, kini susut menjadi 12,76% atau 2.118.848.098 saham.";
    const flagged = ungroundedFigures(point, source);
    const values = flagged.map((figure) => figure.value).sort();

    expect(values).toEqual(["20", "40"]);
  });

  it("accepts the same event when the figures match the source", () => {
    const point = "Public free float of MAPI shrank to 12.76% from 49%";
    const source =
      "Porsi publik susut menjadi 12,76% dari sebelumnya 49% saham beredar.";

    expect(figuresGrounded(point, source)).toBe(true);
  });

  it("treats Indonesian and English separators as the same number", () => {
    const point =
      "Net profit reached Rp 294.85 billion, up 6.81% from Rp 276.05 billion";
    const source =
      "Laba bersih mencapai Rp 294,85 miliar, naik 6,81% dari Rp 276,05 miliar.";

    expect(figuresGrounded(point, source)).toBe(true);
  });

  it("matches a percentage written as persen in the source", () => {
    const point = "MAPI shares rose 22.19% to Rp1,900";
    const source = "Saham MAPI melonjak 22,19 persen ke level Rp1.900 per unit";

    expect(figuresGrounded(point, source)).toBe(true);
  });

  it("matches a scaled figure across trillion and triliun", () => {
    const point = "Fore Coffee's sales reached Rp1 trillion in the first half";
    const source =
      "Penjualan Fore Coffee menembus Rp 1 triliun pada semester I";

    expect(figuresGrounded(point, source)).toBe(true);
  });

  it("ignores bare numbers that carry no unit", () => {
    const point = "Alfamart plans to open 1,000 new stores outside Java";
    const source = "Alfamart akan membuka gerai baru di luar Jawa.";

    expect(ungroundedFigures(point, source)).toEqual([]);
  });

  it("passes a point with no figures at all", () => {
    const point = "Analysts note growth driven by store expansion and Alfagift";
    const source = "Pertumbuhan ditopang ekspansi gerai.";

    expect(figuresGrounded(point, source)).toBe(true);
  });

  it("flags a currency amount absent from the source", () => {
    const point = "Bank Mandiri disbursed Rp 90 billion in investment credit";
    const source = "Bank Mandiri menyalurkan kredit investasi Rp 74 miliar.";
    const flagged = ungroundedFigures(point, source);

    expect(flagged).toEqual([
      { kind: "currency", value: "90" },
      { kind: "scaled", value: "90" },
    ]);
  });
});
