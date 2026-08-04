import { MAX_POINT_LENGTH } from "@workspace/email-templates/newsletter-document";
import { describe, expect, it } from "vitest";

import {
  containsNonLatinScript,
  describesFetchFailure,
  looksTruncated,
  sanitizeSummaryPoints,
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
