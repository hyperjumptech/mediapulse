/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { QUERY_ANALYSIS_INTENTS } from "./query-analysis.js";
import {
  NEWSLETTER_SECTION_IDS,
  SECTION_BY_INTENT,
  sectionsWithoutDedicatedIntent,
} from "./newsletter-sections.js";

describe("SECTION_BY_INTENT", () => {
  it("covers every QueryAnalysisIntent as a key", () => {
    for (const intent of QUERY_ANALYSIS_INTENTS) {
      expect(
        Object.prototype.hasOwnProperty.call(SECTION_BY_INTENT, intent),
        `SECTION_BY_INTENT missing key: ${intent}`,
      ).toBe(true);
    }
  });

  it("has no keys beyond the known intent list", () => {
    const intentSet = new Set<string>(QUERY_ANALYSIS_INTENTS);
    for (const key of Object.keys(SECTION_BY_INTENT)) {
      expect(
        intentSet.has(key),
        `unexpected key in SECTION_BY_INTENT: ${key}`,
      ).toBe(true);
    }
  });

  it("every non-null value is a valid NewsletterSectionId", () => {
    const sectionSet = new Set<string>(NEWSLETTER_SECTION_IDS);
    for (const [intent, sectionId] of Object.entries(SECTION_BY_INTENT)) {
      if (sectionId !== null) {
        expect(
          sectionSet.has(sectionId),
          `SECTION_BY_INTENT['${intent}'] = '${sectionId}' is not a valid NewsletterSectionId`,
        ).toBe(true);
      }
    }
  });

  it("maps competitor to competitiveLandscape", () => {
    expect(SECTION_BY_INTENT.competitor).toBe("competitiveLandscape");
  });

  it("maps regulatory to regulatoryPolicyWatch", () => {
    expect(SECTION_BY_INTENT.regulatory).toBe("regulatoryPolicyWatch");
  });

  it("maps technology_trend and technical to disruptorsOrTech", () => {
    expect(SECTION_BY_INTENT.technology_trend).toBe("disruptorsOrTech");
    expect(SECTION_BY_INTENT.technical).toBe("disruptorsOrTech");
  });

  it("maps industry_trend to industryPulse", () => {
    expect(SECTION_BY_INTENT.industry_trend).toBe("industryPulse");
  });

  it("maps homeless intents to null", () => {
    const homelessIntents = [
      "breaking",
      "kg_change",
      "fundamental",
      "sentiment",
      "supply_chain",
      "esg",
      "macro",
      "geopolitical",
      "wildcard",
    ] as const;
    for (const intent of homelessIntents) {
      expect(SECTION_BY_INTENT[intent]).toBeNull();
    }
  });
});

describe("sectionsWithoutDedicatedIntent", () => {
  it("includes dealsAndMovements", () => {
    expect(sectionsWithoutDedicatedIntent()).toContain("dealsAndMovements");
  });

  it("excludes competitiveLandscape", () => {
    expect(sectionsWithoutDedicatedIntent()).not.toContain(
      "competitiveLandscape",
    );
  });

  it("excludes regulatoryPolicyWatch", () => {
    expect(sectionsWithoutDedicatedIntent()).not.toContain(
      "regulatoryPolicyWatch",
    );
  });

  it("excludes disruptorsOrTech", () => {
    expect(sectionsWithoutDedicatedIntent()).not.toContain("disruptorsOrTech");
  });

  it("excludes industryPulse", () => {
    expect(sectionsWithoutDedicatedIntent()).not.toContain("industryPulse");
  });

  it("returns only valid NewsletterSectionIds", () => {
    const sectionSet = new Set<string>(NEWSLETTER_SECTION_IDS);
    for (const sectionId of sectionsWithoutDedicatedIntent()) {
      expect(sectionSet.has(sectionId)).toBe(true);
    }
  });
});
