/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  buildRelevanceMatchText,
  createTickerRelevanceMatcher,
  routingRelevanceTerms,
} from "./ticker-relevance-gate";

const bankCentralAsia = {
  id: "11111111-1111-4111-a111-111111111111",
  symbol: "BBCA",
  terms: ["BBCA", "Bank Central Asia", "Financials"],
};

describe("createTickerRelevanceMatcher", () => {
  it("matches a symbol as a whole word in capitals", () => {
    const matcher = createTickerRelevanceMatcher([bankCentralAsia]);
    const result = matcher.match("Laba BBCA naik pada kuartal ini");

    expect(result).toEqual({
      tickerId: bankCentralAsia.id,
      tickerSymbol: "BBCA",
      term: "BBCA",
    });
  });

  it("does not match a symbol written as an ordinary lowercase word", () => {
    const matcher = createTickerRelevanceMatcher([
      {
        id: "55555555-5555-4555-a555-555555555555",
        symbol: "AMAN",
        terms: ["AMAN", "Makmur Berkah Amanda"],
      },
    ]);

    expect(matcher.match("Petugas pemadam tetap aman di lapangan")).toBeNull();
    expect(matcher.match("Saham AMAN menguat")).not.toBeNull();
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

describe("matchAll", () => {
  const bankMandiri = {
    id: "66666666-6666-4666-a666-666666666666",
    symbol: "BMRI",
    terms: ["BMRI", "Bank Mandiri", "BBCA", "Bank"],
    issuerTerms: ["BMRI", "Bank Mandiri"],
    competitorTerms: ["BBCA"],
  };
  const bankRaya = {
    id: "77777777-7777-4777-a777-777777777777",
    symbol: "AGRO",
    terms: ["AGRO", "Bank Raya", "Bank"],
    issuerTerms: ["AGRO", "Bank Raya"],
    competitorTerms: [],
  };
  const coalMiner = {
    id: "88888888-8888-4888-a888-888888888888",
    symbol: "AADI",
    terms: ["AADI", "Adaro Andalan", "Batu Bara"],
    issuerTerms: ["AADI", "Adaro Andalan"],
    competitorTerms: [],
  };

  it("reports every ticker the text matches, each on its first matching term", () => {
    const matcher = createTickerRelevanceMatcher([
      bankRaya,
      bankMandiri,
      coalMiner,
    ]);
    const matched = matcher.matchAll(
      "Laba Bank Mandiri (BMRI) Oktober 2026 tembus Rp46,52 triliun",
    );

    expect(matched).toEqual([
      { tickerId: bankRaya.id, tickerSymbol: "AGRO", term: "Bank" },
      { tickerId: bankMandiri.id, tickerSymbol: "BMRI", term: "BMRI" },
    ]);
  });

  it("returns no ticker for text none of them matches", () => {
    const matcher = createTickerRelevanceMatcher([bankRaya, coalMiner]);

    expect(matcher.matchAll("Harga emas naik tipis")).toEqual([]);
    expect(matcher.matchAll("   ")).toEqual([]);
  });

  it("tells whether the terms say which names belong to the issuer", () => {
    expect(createTickerRelevanceMatcher([bankRaya]).hasNamedTerms).toBe(true);
    expect(createTickerRelevanceMatcher([bankCentralAsia]).hasNamedTerms).toBe(
      false,
    );
  });
});

describe("routingRelevanceTerms", () => {
  it("routes on issuer, competitor and specific industry terms only", () => {
    const routed = routingRelevanceTerms({
      id: "99999999-9999-4999-a999-999999999999",
      symbol: "BBCA",
      terms: ["BBCA", "Bank Central Asia", "BMRI", "Bank", "Keuangan"],
      issuerTerms: ["BBCA", "Bank Central Asia"],
      competitorTerms: ["BMRI"],
      industryTerms: ["Bank"],
    });

    expect(routed.terms).toEqual(["BBCA", "Bank Central Asia", "BMRI", "Bank"]);
  });

  it("keeps every term when the lists that split them are missing", () => {
    expect(routingRelevanceTerms(bankCentralAsia)).toEqual(bankCentralAsia);
  });
});

describe("terms that news copy never writes verbatim", () => {
  const cableMaker = {
    id: "22222222-2222-4222-a222-222222222222",
    symbol: "CCSI",
    terms: [
      "CCSI",
      "PT Communication Cable Systems Indonesia Tbk.",
      "Kelistrikan",
      "Komponen & Peralatan Kelistrikan",
      "Perindustrian",
    ],
  };

  it("matches an ampersand term against the Indonesian conjunction", () => {
    const ampersandOnly = createTickerRelevanceMatcher([
      {
        id: "55555555-5555-4555-a555-555555555555",
        symbol: "CCSI",
        terms: ["Komponen & Peralatan Listrik"],
      },
    ]);

    expect(
      ampersandOnly.match("Komponen dan Peralatan Listrik naik tajam"),
    ).not.toBeNull();
    expect(
      ampersandOnly.match("Komponen and Peralatan Listrik demand rises"),
    ).not.toBeNull();
    expect(
      ampersandOnly.match("Komponen & Peralatan Listrik tetap kuat"),
    ).not.toBeNull();
    expect(ampersandOnly.match("Peralatan Listrik saja")).toBeNull();
  });

  it("matches the root word behind a nominalised taxonomy label", () => {
    const matcher = createTickerRelevanceMatcher([cableMaker]);
    const result = matcher.match(
      "Jaringan listrik adalah jalan tol baru Indonesia",
    );

    expect(result).toMatchObject({
      tickerSymbol: "CCSI",
      term: "Kelistrikan",
    });
  });

  it("derives a root only for a single-word term", () => {
    const matcher = createTickerRelevanceMatcher([cableMaker]);

    expect(matcher.match("Pertumbuhan industri manufaktur melambat")).toEqual({
      tickerId: cableMaker.id,
      tickerSymbol: "CCSI",
      term: "Perindustrian",
    });
    expect(matcher.match("Peralatan baru dipasang di pabrik")).toBeNull();
  });

  it("still requires a word boundary on a derived root", () => {
    const matcher = createTickerRelevanceMatcher([cableMaker]);

    expect(matcher.match("Perusahaan listriknya sedang tumbuh")).toBeNull();
    expect(matcher.match("Harga industrialisasi meningkat")).toBeNull();
  });

  it("takes the longest circumfix rather than a shorter overlapping one", () => {
    const matcher = createTickerRelevanceMatcher([
      {
        id: "44444444-4444-4444-a444-444444444444",
        symbol: "NOBU",
        terms: ["Perbankan"],
      },
    ]);

    expect(matcher.match("Laporan rbank dirilis")).toBeNull();
    expect(matcher.match("Kredit perbankan tumbuh")).not.toBeNull();
  });

  it("leaves a short root alone so common words stay unmatched", () => {
    const matcher = createTickerRelevanceMatcher([
      {
        id: "33333333-3333-4333-a333-333333333333",
        symbol: "AGRO",
        terms: ["Keuangan", "Perbankan"],
      },
    ]);

    expect(matcher.match("Dia menabung uang di celengan")).toBeNull();
    expect(matcher.match("Antre di bank sejak pagi")).toBeNull();
    expect(matcher.match("Sektor keuangan tumbuh")).not.toBeNull();
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
