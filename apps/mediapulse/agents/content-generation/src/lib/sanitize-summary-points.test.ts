import { MAX_POINT_LENGTH } from "@workspace/email-templates/newsletter-document";
import { describe, expect, it } from "vitest";

import {
  containsNonLatinScript,
  describesFetchFailure,
  lacksSubstance,
  looksTruncated,
  sanitizeSummaryPoints,
  startsMidSentence,
  startsWithUnanchoredFigure,
  trimToBudget,
} from "./sanitize-summary-points.js";

const padToBudget = (prefix: string): string =>
  prefix.padEnd(MAX_POINT_LENGTH, "x");

describe("startsWithUnanchoredFigure", () => {
  it("flags a figure-led point that lost the noun it measures", () => {
    expect(
      startsWithUnanchoredFigure(
        "11.9% quarterly to 664,000 tons, per Devi Harjoto's report dated August 12, 2026.",
      ),
    ).toBe(true);
  });

  it("flags a currency-led fragment carrying no subject", () => {
    expect(
      startsWithUnanchoredFigure("Rp27.4 trillion by the end of the period."),
    ).toBe(true);
  });

  it("accepts a percentage anchored by the noun it measures", () => {
    expect(
      startsWithUnanchoredFigure(
        "85% of 735 Telkomsel BTS sites in NTT have been restored after the earthquake",
      ),
    ).toBe(false);
    expect(
      startsWithUnanchoredFigure(
        "90% of BCA Digital app users are under 40, aligning with the Gen Z focus.",
      ),
    ).toBe(false);
  });

  it("accepts a count-led point naming its subject", () => {
    expect(
      startsWithUnanchoredFigure(
        "8,100 GrabMerchant partners participated in the campaign supporting drivers",
      ),
    ).toBe(false);
    expect(
      startsWithUnanchoredFigure(
        "200 BTS sites disrupted across 10 districts in NTT after the M7.7 quake",
      ),
    ).toBe(false);
  });

  it("leaves points that do not open on a figure alone", () => {
    expect(
      startsWithUnanchoredFigure(
        "About 2,000 villages remain uncovered by telecom networks, mostly in Papua",
      ),
    ).toBe(false);
    expect(
      startsWithUnanchoredFigure(
        "Coal price rose 0.15% to US$134.25 per ton on August 18, 2026",
      ),
    ).toBe(false);
  });
});

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
  it("trims a point cut off at the budget back to its last complete clause", () => {
    const result = sanitizeSummaryPoints([
      "DCII posted revenue of Rp1.77 trillion and net profit of Rp732.5 billion in H1 2026, up 10.9% and 9.",
    ]);

    expect(result.points).toEqual([
      "DCII posted revenue of Rp1.77 trillion and net profit of Rp732.5 billion in H1 2026.",
    ]);
    expect(result.dropped).toHaveLength(0);
  });

  it("drops a truncated point when nothing substantive survives the trim", () => {
    const result = sanitizeSummaryPoints(["Growth was driven by the"]);

    expect(result.points).toHaveLength(0);
    expect(result.dropped[0]?.reason).toBe("truncated");
  });

  it("keeps clean points untouched", () => {
    const points = [
      "Newcastle coal ended at US$134.00 per ton, down from US$134.05.",
      "India imports fell to 10.88 million tons in July from 12.30 million.",
    ];
    const result = sanitizeSummaryPoints(points);

    expect(result.points).toEqual(points);
    expect(result.dropped).toEqual([]);
  });

  it("drops a figure-led point that lost its subject and keeps the rest", () => {
    const result = sanitizeSummaryPoints([
      "ANTM Q2-2026 gold sales volume rose 15.4% quarterly to 309,200 troy ounces.",
      "11.9% quarterly to 664,000 tons, per Devi Harjoto's report dated August 12, 2026.",
    ]);

    expect(result.points).toEqual([
      "ANTM Q2-2026 gold sales volume rose 15.4% quarterly to 309,200 troy ounces.",
    ]);
    expect(result.dropped).toEqual([
      {
        point:
          "11.9% quarterly to 664,000 tons, per Devi Harjoto's report dated August 12, 2026.",
        reason: "figure_without_subject",
      },
    ]);
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

describe("trimToBudget", () => {
  it("leaves a point already inside the budget untouched", () => {
    const point =
      "Coal export value rose 4.75% to US$14.47 billion in Jan-Jul 2026.";

    expect(trimToBudget(point)).toBe(point);
  });

  it("cuts an over-long point back to its last complete clause", () => {
    const point =
      "Bank Mandiri posted a net profit of Rp30.41 trillion in the first half of 2026, and management guided to further growth across its corporate lending book.";

    expect(point.length).toBeGreaterThan(MAX_POINT_LENGTH);

    const trimmed = trimToBudget(point);

    expect(trimmed).toBe(
      "Bank Mandiri posted a net profit of Rp30.41 trillion in the first half of 2026.",
    );
  });

  it("drops an over-long point that carries no clause boundary to cut at", () => {
    const point =
      "The government plans to optimize Public Service Agency functions in energy so that it can supply coal and gas to power plants under a new Presidential Regulation.";

    expect(point.length).toBeGreaterThan(MAX_POINT_LENGTH);
    expect(trimToBudget(point)).toBeNull();
  });
});

describe("sanitizeSummaryPoints — budget enforcement", () => {
  it("never emits a point longer than the budget", () => {
    const result = sanitizeSummaryPoints([
      "Bank Mandiri posted a net profit of Rp30.41 trillion in the first half of 2026, and management guided to further growth across its corporate lending book.",
    ]);

    expect(result.points).toHaveLength(1);
    for (const point of result.points) {
      expect(point.length).toBeLessThanOrEqual(MAX_POINT_LENGTH);
    }
  });

  it("reports an unsalvageable over-long point as over_budget", () => {
    const result = sanitizeSummaryPoints([
      "The government plans to optimize Public Service Agency functions in energy so that it can supply coal and gas to power plants under a new Presidential Regulation.",
    ]);

    expect(result.points).toHaveLength(0);
    expect(result.dropped[0]?.reason).toBe("over_budget");
  });
});

describe("looksTruncated on abbreviations and trailing fragments", () => {
  it.each([
    "Prof Ida Nurlinda said the Industrial Zone Bill should not re-regulate land issues already covered by Law No.",
    "Minister Meutya Hafid officially bans all cellular operators from forfeiting customers' remaining internet quota per Circular No.",
    "BPOM supports domestic innovation through special regulatory pathways per BPOM regulations No. 8 and No.",
  ])("treats a point stopping on an abbreviation as truncated: %s", (point) => {
    expect(looksTruncated(point)).toBe(true);
  });

  it("treats a bare prepositional phrase after a clause break as truncated", () => {
    const point =
      "PNBP tariffs range from 15% to 28% depending on HBA levels; at US$126.87.";

    expect(looksTruncated(point)).toBe(true);
  });

  it.each([
    "Indonesia targets 69.5 GW additional power capacity by 2034.",
    "TLKM's NeutraDC targets 300-500 MW total data center capacity by 2030.",
    "Grab expects the deal to add at least $60 million in adjusted core profit by 2028",
    "Indonesia's data center capacity to increase from 580 MW to 3.5 GW by 2030",
  ])("leaves a sentence ending on a target year alone: %s", (point) => {
    expect(looksTruncated(point)).toBe(false);
  });

  it("still catches a figure cut away from its unit", () => {
    expect(looksTruncated("Operating profit grew by 12")).toBe(true);
  });

  it.each([
    "The Ministry of Energy set the reference coal price at US$126.87 per ton for early September 2026.",
    "Bank Mandiri booked net profit of Rp30.4 trillion in H1 2026, up 24.4% year on year.",
    "Telkomsel net profit rose 8.3% year on year, to Rp10.4 trillion.",
    "Bank Indonesia raised its macroprudential liquidity incentive to 6%.",
  ])("leaves a complete sentence alone: %s", (point) => {
    expect(looksTruncated(point)).toBe(false);
  });

  it("drops a point whose only clause boundary would still end on an abbreviation", () => {
    const point =
      "BPOM supports domestic innovation through special regulatory pathways per BPOM regulations No. 8 and No.";

    const result = sanitizeSummaryPoints([point]);

    expect(result.points).toStrictEqual([]);
    expect(result.dropped).toStrictEqual([{ point, reason: "truncated" }]);
  });
});
