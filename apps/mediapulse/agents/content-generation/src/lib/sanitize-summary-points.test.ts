import { MAX_POINT_LENGTH } from "@workspace/email-templates/newsletter-document";
import { describe, expect, it } from "vitest";

import {
  containsNonLatinScript,
  describesFetchFailure,
  lacksSubstance,
  looksTruncated,
  sanitizeSummaryPoints,
  startsMidSentence,
} from "./sanitize-summary-points.js";

const padToBudget = (prefix: string): string =>
  prefix.padEnd(MAX_POINT_LENGTH, "x");

describe("containsNonLatinScript", () => {
  it("flags a Han glyph inside English prose", () => {
    expect(
      containsNonLatinScript(
        "Policy strengthens resilience while safeguarding矿业",
      ),
    ).toBe(true);
  });

  it("flags a Kana or Hangul glyph", () => {
    expect(containsNonLatinScript("Placed for at least three月")).toBe(true);
    expect(containsNonLatinScript("Marketing aid consumer理解")).toBe(true);
  });

  it("accepts Latin text with accents, currency, and punctuation", () => {
    expect(
      containsNonLatinScript(
        "Newcastle coal closed at US$134.00 per ton, down 1.03% week on week.",
      ),
    ).toBe(false);
    expect(containsNonLatinScript("Café openings rose 12% in Cikarang.")).toBe(
      false,
    );
  });
});

describe("looksTruncated", () => {
  it("flags a point that hits the character budget without a terminal character", () => {
    const point = padToBudget(
      "SME financing grew 1.99% to Rp27.4 trillion; third-party funds rose 14.36% by 202",
    );

    expect(point.length).toBe(MAX_POINT_LENGTH);
    expect(looksTruncated(point)).toBe(true);
  });

  it("flags a short point ending on a dangling word", () => {
    expect(
      looksTruncated("Partnership strengthens national pharma via tech and"),
    ).toBe(true);
    expect(
      looksTruncated("TCBI will launch products combining SBP and TSN"),
    ).toBe(false);
  });

  it("accepts a full-length point that ends on a terminal character", () => {
    const point = padToBudget(
      "Net profit rose to US$10.2 million from US$2.2 million a year earlier",
    ).slice(0, MAX_POINT_LENGTH - 1);

    expect(looksTruncated(`${point}.`)).toBe(false);
  });

  it("accepts a short point with no terminal punctuation", () => {
    expect(looksTruncated("Coal prices fell 1.25% on July 28, 2026")).toBe(
      false,
    );
  });

  it("ignores an empty point", () => {
    expect(looksTruncated("   ")).toBe(false);
  });
});

describe("startsMidSentence", () => {
  it("flags a point that lost its subject", () => {
    expect(
      startsMidSentence(
        "manages universal service obligation financing and telecom infrastructure.",
      ),
    ).toBe(true);
  });

  it("flags a point opening on a conjunction", () => {
    expect(
      startsMidSentence(
        "and satellite to support national digital transformation across Indonesia's remote areas.",
      ),
    ).toBe(true);
  });

  it("keeps a point opening on a capital or a digit", () => {
    expect(startsMidSentence("Telkom Akses built 366,000 new ports.")).toBe(
      false,
    );
    expect(startsMidSentence("366,000 new ports were built in H1 2026.")).toBe(
      false,
    );
  });

  it("keeps a brand carrying an interior capital", () => {
    expect(startsMidSentence("eFishery raised a new funding round.")).toBe(
      false,
    );
    expect(startsMidSentence("iPhone shipments rose 4% in Q2.")).toBe(false);
  });

  it("treats an empty point as complete", () => {
    expect(startsMidSentence("   ")).toBe(false);
  });
});

describe("describesFetchFailure", () => {
  it("flags points shipped in the 2026-08-04 batch", () => {
    expect(
      describesFetchFailure(
        "Article content not found; no key facts available.",
      ),
    ).toBe(true);
    expect(
      describesFetchFailure(
        "Website sekbernews.id shows error code 520 and cannot display page content",
      ),
    ).toBe(true);
    expect(
      describesFetchFailure(
        "Unknown connection issue between Cloudflare and origin web server occurred",
      ),
    ).toBe(true);
    expect(
      describesFetchFailure(
        "No detailed information on Telkom Indonesia's data center expansion available",
      ),
    ).toBe(true);
    expect(
      describesFetchFailure(
        "No additional operational or market details available due to website error",
      ),
    ).toBe(true);
  });

  it("flags block and paywall pages", () => {
    expect(describesFetchFailure("Access denied for this request")).toBe(true);
    expect(
      describesFetchFailure("The page returned a 403 Forbidden response"),
    ).toBe(true);
    expect(
      describesFetchFailure("Subscription required to read the full report"),
    ).toBe(true);
  });

  it("accepts ordinary business prose that mentions absence or failure", () => {
    expect(
      describesFetchFailure(
        "No financial details were disclosed for the acquisition.",
      ),
    ).toBe(false);
    expect(
      describesFetchFailure(
        "The company said its Cikarang site is unavailable for new tenants",
      ),
    ).toBe(false);
    expect(
      describesFetchFailure("Net profit fell 2.8% to Rp1.91 trillion."),
    ).toBe(false);
    expect(
      describesFetchFailure(
        "Management could not be reached for comment on the tender offer",
      ),
    ).toBe(false);
    expect(
      describesFetchFailure(
        "The article 404 platform launched across 12 provinces",
      ),
    ).toBe(false);
  });
});

describe("sanitizeSummaryPoints", () => {
  it("keeps clean points untouched", () => {
    const points = [
      "Newcastle coal ended at US$134.00 per ton, down from US$134.05.",
      "India imports fell to 10.88 million tons in July from 12.30 million.",
    ];
    const result = sanitizeSummaryPoints(points);

    expect(result.points).toEqual(points);
    expect(result.dropped).toEqual([]);
  });

  it("drops a non-Latin point and reports the reason", () => {
    const result = sanitizeSummaryPoints([
      "Policy requires 30% of export proceeds in special accounts.",
      "Banking sector safeguards矿业 liquidity for exporters",
    ]);

    expect(result.points).toEqual([
      "Policy requires 30% of export proceeds in special accounts.",
    ]);
    expect(result.dropped).toEqual([
      {
        point: "Banking sector safeguards矿业 liquidity for exporters",
        reason: "non_latin_script",
      },
    ]);
  });

  it("drops a truncated point and reports the reason", () => {
    const truncated = padToBudget(
      "Third-party funds rose 14.36% to Rp47.9 trillion by 202",
    );
    const result = sanitizeSummaryPoints([
      "CIMB Niaga won Best SME Bank Indonesia 2026.",
      truncated,
    ]);

    expect(result.points).toEqual([
      "CIMB Niaga won Best SME Bank Indonesia 2026.",
    ]);
    expect(result.dropped).toEqual([{ point: truncated, reason: "truncated" }]);
  });

  it("returns no points when every point is broken", () => {
    const result = sanitizeSummaryPoints([
      "Placed for at least three月",
      "Expansion continues across the",
    ]);

    expect(result.points).toEqual([]);
    expect(result.dropped).toHaveLength(2);
  });

  it("empties an article built entirely from an error page", () => {
    const result = sanitizeSummaryPoints([
      "Website sekbernews.id shows error code 520 and cannot display page content",
      "Unknown connection issue between Cloudflare and origin web server occurred",
      "No detailed information on Telkom Indonesia's data center expansion available",
    ]);

    expect(result.points).toEqual([]);
    expect(result.dropped.map((entry) => entry.reason)).toEqual([
      "fetch_failure",
      "fetch_failure",
      "fetch_failure",
    ]);
  });
});

describe("lacksSubstance", () => {
  it("flags a point reporting what the article did not detail", () => {
    expect(
      lacksSubstance(
        "Purpose of new credit and relation to BSI repayment not detailed.",
      ),
    ).toBe(true);
    expect(lacksSubstance("Terms of the agreement were not specified.")).toBe(
      true,
    );
    expect(
      lacksSubstance("The filing does not say when trading resumes."),
    ).toBe(true);
    expect(lacksSubstance("Reason for the delay remains unclear.")).toBe(true);
  });

  it("flags an assertion of potential or the bare need for a strategy", () => {
    expect(
      lacksSubstance(
        "Industrial area development in Indonesia still has significant growth potential",
      ),
    ).toBe(true);
    expect(
      lacksSubstance(
        "Expansion of industrial areas requires strategic approaches",
      ),
    ).toBe(true);
  });

  it("keeps a company declining to disclose a figure, which is ordinary deal reporting", () => {
    expect(
      lacksSubstance(
        "Mitra Adiperkasa did not disclose the transaction value.",
      ),
    ).toBe(false);
    expect(lacksSubstance("No financial details were disclosed.")).toBe(false);
  });

  it("keeps qualitative points that name something concrete", () => {
    expect(
      lacksSubstance(
        "Focus remains on product quality, fast service, and cleanliness as key competitive factors.",
      ),
    ).toBe(false);
    expect(
      lacksSubstance(
        "Initiative aims to digitalize MSMEs and enhance local education sector.",
      ),
    ).toBe(false);
    expect(
      lacksSubstance(
        "Gold sales fell 38.2% to 18,080 kg while ferronickel sales rose 32%.",
      ),
    ).toBe(false);
  });
});

describe("sanitizeSummaryPoints — no-substance points", () => {
  it("drops the absent-information point and keeps the facts beside it", () => {
    const result = sanitizeSummaryPoints([
      "DKHH secures Rp74 billion investment credit facility from Bank Mandiri.",
      "DKHH repays Rp40.22 billion financing early at PT Bank Syariah Indonesia.",
      "Purpose of new credit and relation to BSI repayment not detailed.",
    ]);

    expect(result.points).toEqual([
      "DKHH secures Rp74 billion investment credit facility from Bank Mandiri.",
      "DKHH repays Rp40.22 billion financing early at PT Bank Syariah Indonesia.",
    ]);
    expect(result.dropped).toEqual([
      {
        point:
          "Purpose of new credit and relation to BSI repayment not detailed.",
        reason: "no_substance",
      },
    ]);
  });

  it("empties an article whose every point asserts only potential", () => {
    const result = sanitizeSummaryPoints([
      "Industrial area development in Indonesia still has significant growth potential",
      "Expansion of industrial areas requires strategic approaches",
    ]);

    expect(result.points).toEqual([]);
    expect(result.dropped.map((entry) => entry.reason)).toEqual([
      "no_substance",
      "no_substance",
    ]);
  });
});
