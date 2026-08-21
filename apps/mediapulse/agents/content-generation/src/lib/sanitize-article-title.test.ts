import { describe, expect, it } from "vitest";

import { sanitizeArticleTitle } from "./sanitize-article-title.js";

describe("sanitizeArticleTitle", () => {
  it("strips a leading publisher emoji", () => {
    expect(
      sanitizeArticleTitle(
        "🌷 BI Maintains Interest Rate at 5.75%, Expands Stabilization Incentives",
      ),
    ).toBe(
      "BI Maintains Interest Rate at 5.75%, Expands Stabilization Incentives",
    );
  });

  it("strips a leading bullet, arrow, or square marker", () => {
    expect(sanitizeArticleTitle("• Coal price rises to US$134.25")).toBe(
      "Coal price rises to US$134.25",
    );
    expect(sanitizeArticleTitle("▶ XLSMART posts Rp2.73 trillion profit")).toBe(
      "XLSMART posts Rp2.73 trillion profit",
    );
    expect(sanitizeArticleTitle("→ OJK confirms SBN incentives")).toBe(
      "OJK confirms SBN incentives",
    );
  });

  it("strips a trailing emoji and surrounding whitespace", () => {
    expect(sanitizeArticleTitle("  GOTO removed from MSCI index 🚨 ")).toBe(
      "GOTO removed from MSCI index",
    );
  });

  it("leaves an ordinary title untouched", () => {
    expect(
      sanitizeArticleTitle(
        "BCA (BBCA) Distributes Interim Dividend for Q3-2026, Amount Specified",
      ),
    ).toBe(
      "BCA (BBCA) Distributes Interim Dividend for Q3-2026, Amount Specified",
    );
  });

  it("keeps leading characters that carry meaning", () => {
    expect(sanitizeArticleTitle("$600 million foodpanda deal cleared")).toBe(
      "$600 million foodpanda deal cleared",
    );
    expect(sanitizeArticleTitle('"Coal is back", says Bahlil')).toBe(
      '"Coal is back", says Bahlil',
    );
    expect(sanitizeArticleTitle("85% of BTS sites restored in NTT")).toBe(
      "85% of BTS sites restored in NTT",
    );
  });

  it("falls back to the trimmed original when a title is only decoration", () => {
    expect(sanitizeArticleTitle(" 🌷 ")).toBe("🌷");
  });
});
