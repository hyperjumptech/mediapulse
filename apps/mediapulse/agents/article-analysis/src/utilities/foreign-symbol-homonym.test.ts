import { describe, expect, it } from "vitest";

import { namesForeignSymbolHomonym } from "./foreign-symbol-homonym.js";
import type { AnalysisTickerContext } from "@workspace/agent-data-api-contract";

const ticker = (
  overrides: Partial<AnalysisTickerContext> = {},
): AnalysisTickerContext =>
  ({
    symbol: "CCSI",
    name: "PT Communication Cable Systems Indonesia Tbk",
    aliases: [],
    ...overrides,
  }) as AnalysisTickerContext;

describe("namesForeignSymbolHomonym", () => {
  it("flags a symbol qualified by a foreign exchange", () => {
    const text =
      "CCSI officer exercises PSUs, withholds shares for tax. Consensus Cloud (NASDAQ: CCSI) officer vests performance units.";

    expect(namesForeignSymbolHomonym(text, ticker())).toBe(true);
  });

  it("flags a symbol qualified by a foreign exchange with no space", () => {
    const text =
      "Consensus Cloud Solutions (NASDAQ:CCSI) Given New $45.00 Price Target at BTIG Research";

    expect(namesForeignSymbolHomonym(text, ticker())).toBe(true);
  });

  it("flags a symbol bound to a name carrying a foreign corporate designator", () => {
    const text =
      "CCSI Q1 2026 Earnings: EPS Beats Estimates by 7.4%. Consensus Cloud Solutions Inc. (CCSI) reported first-quarter 2026 earnings per share of $1.52.";

    expect(namesForeignSymbolHomonym(text, ticker())).toBe(true);
  });

  it("does not flag the issuer's own Indonesian name binding", () => {
    const text =
      "PT Communication Cable Systems Indonesia Tbk (CCSI) mencatat kenaikan penjualan kabel serat optik pada semester I 2026.";

    expect(namesForeignSymbolHomonym(text, ticker())).toBe(false);
  });

  it("does not flag a bare symbol mention with no company binding", () => {
    const text =
      "Produsen alat kelistrikan lokal termasuk CCSI menghadapi tekanan impor dari kawasan ekonomi khusus.";

    expect(namesForeignSymbolHomonym(text, ticker())).toBe(false);
  });

  it("does not flag the issuer's own exchange", () => {
    const text = "Saham IDX: CCSI ditutup menguat pada perdagangan hari ini.";

    expect(namesForeignSymbolHomonym(text, ticker())).toBe(false);
  });

  it("does not flag a foreign exchange qualifying some other symbol", () => {
    const text =
      "Nvidia (NASDAQ: NVDA) memasok GPU untuk pusat data baru, sementara CCSI memasok kabelnya.";

    expect(namesForeignSymbolHomonym(text, ticker())).toBe(false);
  });

  it("does not flag when the ticker context is absent", () => {
    const text = "Consensus Cloud Solutions Inc. (CCSI) reported earnings.";

    expect(namesForeignSymbolHomonym(text, null)).toBe(false);
  });

  it("does not flag an empty text", () => {
    expect(namesForeignSymbolHomonym("   ", ticker())).toBe(false);
  });

  it("ignores a symbol too short or too long to be an IDX listing", () => {
    const text = "Something Inc. (VERYLONGSYM) reported earnings.";

    expect(
      namesForeignSymbolHomonym(text, ticker({ symbol: "VERYLONGSYM" })),
    ).toBe(false);
  });

  it("flags a Group designator binding for a four-letter issuer symbol", () => {
    const text = "Antam Holdings Group (ASX: ANTM) lifted its dividend.";

    expect(namesForeignSymbolHomonym(text, ticker({ symbol: "ANTM" }))).toBe(
      true,
    );
  });
});
