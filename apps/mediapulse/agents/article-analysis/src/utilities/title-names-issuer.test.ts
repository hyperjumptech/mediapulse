/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { AnalysisTickerContext } from "@workspace/agent-data-api-contract";

import { titleNamesIssuer } from "./title-names-issuer.js";

const ticker = (
  overrides: Partial<AnalysisTickerContext>,
): AnalysisTickerContext => ({
  symbol: "AGRO",
  name: "PT Bank Raya Indonesia Tbk",
  sector: null,
  industry: null,
  subIndustry: null,
  businessActivity: null,
  aliases: [],
  competitors: [],
  regulators: [],
  ...overrides,
});

describe("titleNamesIssuer", () => {
  it("matches a brand alias that is not the registered name", () => {
    const agro = ticker({
      aliases: ["AGRO", "BRI Agroniaga", "Bank Raya", "Bank Raya Indonesia"],
    });

    expect(
      titleNamesIssuer(
        "Dorong Kinerja, Bank Raya Genjot Literasi Keuangan Digital",
        agro,
      ),
    ).toBe(true);
  });

  it("matches a bracketed ticker symbol", () => {
    const antm = ticker({
      symbol: "ANTM",
      name: "Aneka Tambang Tbk.",
      aliases: ["ANTM", "Antam", "Logam Mulia"],
    });

    expect(
      titleNamesIssuer(
        "Antam (ANTM) Cetak Kinerja Operasional Ciamik di Semester I-2026",
        antm,
      ),
    ).toBe(true);
  });

  it("matches a bare uppercase symbol in the headline", () => {
    const fore = ticker({
      symbol: "FORE",
      name: "PT Fore Kopi Indonesia Tbk",
      aliases: ["FORE", "Fore Coffee", "Fore Kopi Indonesia"],
    });

    expect(
      titleNamesIssuer("FORE Tunda Ekspansi di Singapura, Ongkos Mahal", fore),
    ).toBe(true);
  });

  it("does not match a different company that merely shares the symbol's letters", () => {
    const aman = ticker({
      symbol: "AMAN",
      name: "PT Makmur Berkah Amanda Tbk.",
      aliases: ["AMAN", "Makmur Berkah Amanda"],
    });

    expect(
      titleNamesIssuer(
        "Laba PT Aman Agrindo (GULA) Berbalik Positif, Penjualan Melonjak 121,5 Persen",
        aman,
      ),
    ).toBe(false);
  });

  it("does not match a symbol embedded in a longer word", () => {
    const agro = ticker({ aliases: ["AGRO"] });

    expect(titleNamesIssuer("AGROINDUSTRI tumbuh pesat tahun ini", agro)).toBe(
      false,
    );
  });

  it("does not match a competitor headline", () => {
    const agro = ticker({ aliases: ["AGRO", "Bank Raya"] });

    expect(
      titleNamesIssuer(
        "Net Profit of Bank Neo Commerce Rises to Rp 294.85 Billion",
        agro,
      ),
    ).toBe(false);
  });

  it("returns false without ticker context", () => {
    expect(titleNamesIssuer("Bank Raya posts Q2 profit", null)).toBe(false);
  });
});
