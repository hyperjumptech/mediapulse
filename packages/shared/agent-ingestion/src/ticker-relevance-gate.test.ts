/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  buildRelevanceMatchText,
  createTickerRelevanceMatcher,
} from "./ticker-relevance-gate";

const bankCentralAsia = {
  id: "11111111-1111-4111-a111-111111111111",
  symbol: "BBCA",
  terms: ["BBCA", "Bank Central Asia", "Financials"],
};

describe("createTickerRelevanceMatcher", () => {
  it("matches a symbol as a whole word regardless of case", () => {
    const matcher = createTickerRelevanceMatcher([bankCentralAsia]);
    const result = matcher.match("Laba bbca naik pada kuartal ini");

    expect(result).toEqual({
      tickerId: bankCentralAsia.id,
      tickerSymbol: "BBCA",
      term: "BBCA",
    });
  });

  it("does not match a symbol embedded inside a longer word", () => {
    const matcher = createTickerRelevanceMatcher([bankCentralAsia]);

    expect(matcher.match("The BBCAX fund posted gains")).toBeNull();
    expect(matcher.match("Report from XBBCA analysts")).toBeNull();
    expect(matcher.match("BBCA2 is a different instrument")).toBeNull();
  });

  it("matches a symbol adjacent to punctuation and line breaks", () => {
    const matcher = createTickerRelevanceMatcher([bankCentralAsia]);

    expect(matcher.match("Shares of (BBCA) rose.")).not.toBeNull();
    expect(matcher.match("Coverage:\nBBCA, BMRI")).not.toBeNull();
  });

  it("matches a multi-word term only as a full phrase", () => {
    const matcher = createTickerRelevanceMatcher([bankCentralAsia]);

    expect(matcher.match("PT Bank Central Asia Tbk reported")).not.toBeNull();
    expect(matcher.match("Bank Negara and Central Java news")).toBeNull();
  });

  it("tolerates collapsed whitespace inside a multi-word term", () => {
    const matcher = createTickerRelevanceMatcher([bankCentralAsia]);
    const result = matcher.match("Bank  Central\nAsia announced a dividend");

    expect(result?.term).toBe("Bank Central Asia");
  });

  it("escapes regular expression metacharacters in terms", () => {
    const matcher = createTickerRelevanceMatcher([
      {
        id: "22222222-2222-4222-a222-222222222222",
        symbol: "BBCA.JK",
        terms: ["BBCA.JK"],
      },
    ]);

    expect(matcher.match("Quote for BBCA.JK today")).not.toBeNull();
    expect(matcher.match("Quote for BBCAXJK today")).toBeNull();
  });

  it("reports the ticker that owns the matched term", () => {
    const matcher = createTickerRelevanceMatcher([
      bankCentralAsia,
      {
        id: "33333333-3333-4333-a333-333333333333",
        symbol: "TLKM",
        terms: ["TLKM", "Telkom Indonesia"],
      },
    ]);
    const result = matcher.match("Telkom Indonesia expands its data centres");

    expect(result).toEqual({
      tickerId: "33333333-3333-4333-a333-333333333333",
      tickerSymbol: "TLKM",
      term: "Telkom Indonesia",
    });
  });

  it("skips blank terms and reports an empty matcher when nothing compiles", () => {
    const matcher = createTickerRelevanceMatcher([
      {
        id: "44444444-4444-4444-a444-444444444444",
        symbol: "EMPTY",
        terms: ["", "   "],
      },
    ]);

    expect(matcher.isEmpty).toBe(true);
    expect(matcher.match("Any text at all")).toBeNull();
  });

  it("reports an empty matcher when no tickers are returned", () => {
    const matcher = createTickerRelevanceMatcher([]);

    expect(matcher.isEmpty).toBe(true);
    expect(matcher.match("Any text at all")).toBeNull();
  });

  it("returns null for blank candidate text", () => {
    const matcher = createTickerRelevanceMatcher([bankCentralAsia]);

    expect(matcher.match("   ")).toBeNull();
  });
});

describe("buildRelevanceMatchText", () => {
  it("joins title and description", () => {
    const text = buildRelevanceMatchText("Article title", "Feed description");

    expect(text).toBe("Article title Feed description");
  });

  it("tolerates a missing title or description", () => {
    expect(buildRelevanceMatchText(undefined, "Feed description")).toBe(
      "Feed description",
    );
    expect(buildRelevanceMatchText("Article title", undefined)).toBe(
      "Article title",
    );
    expect(buildRelevanceMatchText(undefined, undefined)).toBe("");
  });
});
