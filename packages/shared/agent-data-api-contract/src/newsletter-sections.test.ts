/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { QUERY_ANALYSIS_INTENTS } from "./query-analysis.js";
import {
  NEWSLETTER_SECTION_IDS,
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

  it("covers every section except quickHits", () => {
    const intents = new Set<string>(QUERY_ANALYSIS_INTENTS);
    const unfedSections = NEWSLETTER_SECTION_IDS.filter(
      (sectionId) => !intents.has(sectionId),
    );

    expect(unfedSections).toEqual(["quickHits"]);
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
