/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { QUERY_ANALYSIS_INTENTS } from "./query-analysis.js";
import {
  MEDIAPULSE_NEWSLETTER_SECTIONS,
  NEWSLETTER_SECTION_IDS,
  NEWSLETTER_SECTION_PRECEDENCE,
  summarizeSectionCoverage,
} from "./newsletter-sections.js";

describe("QUERY_ANALYSIS_INTENTS", () => {
  it("names every intent after a newsletter section", () => {
    const sectionIds = new Set<string>(NEWSLETTER_SECTION_IDS);
    for (const intent of QUERY_ANALYSIS_INTENTS) {
      expect(
        sectionIds.has(intent),
        `intent '${intent}' is not a NewsletterSectionId`,
      ).toBe(true);
    }
  });

  it("excludes quickHits, which no query feeds", () => {
    const intents = new Set<string>(QUERY_ANALYSIS_INTENTS);

    expect(intents.has("quickHits")).toBe(false);
  });

  it("covers every section a generated query can feed", () => {
    const intents = new Set<string>(QUERY_ANALYSIS_INTENTS);
    const unfedSections = NEWSLETTER_SECTION_IDS.filter(
      (sectionId) => !intents.has(sectionId),
    );

    expect(unfedSections).toEqual([
      "issuerPerformance",
      "issuerNews",
      "quickHits",
    ]);
  });
});

describe("summarizeSectionCoverage", () => {
  it("returns an entry for every section id, including zero-coverage ones", () => {
    const result = summarizeSectionCoverage([
      "industryPulse",
      "dealsAndMovements",
    ]);
    for (const sectionId of NEWSLETTER_SECTION_IDS) {
      expect(result).toHaveProperty(sectionId);
    }
  });

  it("always reports zero coverage for quickHits", () => {
    const result = summarizeSectionCoverage([
      "competitiveLandscape",
      "industryPulse",
    ]);

    expect(result.quickHits.count).toBe(0);
    expect(result.quickHits.share).toBe(0);
  });

  it("counts queries per section correctly", () => {
    const result = summarizeSectionCoverage([
      "competitiveLandscape",
      "competitiveLandscape",
      "regulatoryPolicyWatch",
      "industryPulse",
    ]);

    expect(result.competitiveLandscape.count).toBe(2);
    expect(result.regulatoryPolicyWatch.count).toBe(1);
    expect(result.industryPulse.count).toBe(1);
    expect(result.dealsAndMovements.count).toBe(0);
  });

  it("credits dealsAndMovements when that intent is present", () => {
    const result = summarizeSectionCoverage([
      "dealsAndMovements",
      "dealsAndMovements",
      "regulatoryPolicyWatch",
    ]);

    expect(result.dealsAndMovements.count).toBe(2);
    expect(result.dealsAndMovements.share).toBeGreaterThan(0);
    expect(result.regulatoryPolicyWatch.count).toBe(1);
  });

  it("shares sum to 1.0 over sections with positive count", () => {
    const result = summarizeSectionCoverage([
      "competitiveLandscape",
      "regulatoryPolicyWatch",
      "industryPulse",
      "disruptorsOrTech",
    ]);
    const totalShare = NEWSLETTER_SECTION_IDS.filter(
      (sectionId) => result[sectionId].count > 0,
    ).reduce((sum, sectionId) => sum + result[sectionId].share, 0);

    expect(totalShare).toBeCloseTo(1.0);
  });

  it("returns all zeros on empty input", () => {
    const result = summarizeSectionCoverage([]);
    for (const sectionId of NEWSLETTER_SECTION_IDS) {
      expect(result[sectionId].count).toBe(0);
      expect(result[sectionId].share).toBe(0);
    }
  });
});

describe("issuerNews", () => {
  const displayOrder = MEDIAPULSE_NEWSLETTER_SECTIONS.map(
    (section) => section.id,
  );

  it("is displayed under the issuer's own results and above any peer", () => {
    expect(displayOrder.indexOf("issuerNews")).toBeGreaterThan(
      displayOrder.indexOf("issuerPerformance"),
    );
    expect(displayOrder.indexOf("issuerNews")).toBeLessThan(
      displayOrder.indexOf("competitiveLandscape"),
    );
  });

  it("loses to issuerPerformance so a reported result keeps the narrower section", () => {
    expect(NEWSLETTER_SECTION_PRECEDENCE.indexOf("issuerNews")).toBeGreaterThan(
      NEWSLETTER_SECTION_PRECEDENCE.indexOf("issuerPerformance"),
    );
  });

  it("outranks every catch-all and every peer or deal section", () => {
    const issuerNews = NEWSLETTER_SECTION_PRECEDENCE.indexOf("issuerNews");
    for (const section of [
      "dealsAndMovements",
      "competitiveLandscape",
      "regulatoryPolicyWatch",
      "disruptorsOrTech",
      "industryPulse",
      "quickHits",
    ] as const) {
      expect(NEWSLETTER_SECTION_PRECEDENCE.indexOf(section)).toBeGreaterThan(
        issuerNews,
      );
    }
  });

  it("is a section every id list already carries", () => {
    expect(NEWSLETTER_SECTION_IDS).toContain("issuerNews");
    expect(NEWSLETTER_SECTION_PRECEDENCE).toHaveLength(
      NEWSLETTER_SECTION_IDS.length,
    );
  });
});
