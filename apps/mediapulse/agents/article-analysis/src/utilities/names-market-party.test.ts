/** @vitest-environment node */

import type { AnalysisTickerContext } from "@workspace/agent-data-api-contract";
import { describe, expect, it } from "vitest";

import { textNamesMarketParty } from "./names-market-party";

const context = (
  competitors: { name: string; aliases: string[] }[],
  regulators: { name: string; aliases: string[] }[] = [],
): AnalysisTickerContext =>
  ({
    symbol: "TEST",
    name: "Test Issuer",
    aliases: [],
    competitors,
    regulators,
  }) as unknown as AnalysisTickerContext;

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
    });
  });

  it("finds a competitor named by its alias", () => {
    const match = textNamesMarketParty(
      "TOMORO COFFEE Collaborates with Muhammad Aga to Launch a New Series",
      fore,
    );

    expect(match).toStrictEqual({ kind: "competitor", name: "Tomoro Coffee" });
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
