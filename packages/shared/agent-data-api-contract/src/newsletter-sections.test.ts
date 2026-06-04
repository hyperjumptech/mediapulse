/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { QUERY_ANALYSIS_INTENTS } from "./query-analysis.js";
import {
  classifyQueryToSection,
  NEWSLETTER_SECTION_IDS,
  SECTION_BY_INTENT,
  sectionsWithoutDedicatedIntent,
  summarizeSectionCoverage,
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

describe("classifyQueryToSection", () => {
  it("returns null for homeless intents", () => {
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
      expect(classifyQueryToSection(intent)).toBeNull();
    }
  });

  it("returns the correct section id for mapped intents", () => {
    expect(classifyQueryToSection("competitor")).toBe("competitiveLandscape");
    expect(classifyQueryToSection("regulatory")).toBe("regulatoryPolicyWatch");
    expect(classifyQueryToSection("technology_trend")).toBe("disruptorsOrTech");
    expect(classifyQueryToSection("technical")).toBe("disruptorsOrTech");
    expect(classifyQueryToSection("industry_trend")).toBe("industryPulse");
  });

  it("is consistent with SECTION_BY_INTENT", () => {
    for (const [intent, expected] of Object.entries(SECTION_BY_INTENT)) {
      expect(
        classifyQueryToSection(intent as keyof typeof SECTION_BY_INTENT),
      ).toBe(expected);
    }
  });
});

describe("summarizeSectionCoverage", () => {
  it("returns an entry for every section id, including zero-coverage ones", () => {
    const result = summarizeSectionCoverage(["breaking", "sentiment", "macro"]);
    for (const sectionId of NEWSLETTER_SECTION_IDS) {
      expect(result).toHaveProperty(sectionId);
    }
  });

  it("zero-coverage sections have count 0 and share 0", () => {
    const result = summarizeSectionCoverage(["competitor"]);

    expect(result.dealsAndMovements.count).toBe(0);
    expect(result.dealsAndMovements.share).toBe(0);
    expect(result.quickHits.count).toBe(0);
    expect(result.quickHits.share).toBe(0);
  });

  it("counts queries per mapped section correctly", () => {
    const result = summarizeSectionCoverage([
      "competitor",
      "competitor",
      "regulatory",
      "industry_trend",
    ]);

    expect(result.competitiveLandscape.count).toBe(2);
    expect(result.regulatoryPolicyWatch.count).toBe(1);
    expect(result.industryPulse.count).toBe(1);
    expect(result.dealsAndMovements.count).toBe(0);
  });

  it("shares sum to 1.0 over sections with positive count when all intents are classified", () => {
    const result = summarizeSectionCoverage([
      "competitor",
      "regulatory",
      "industry_trend",
      "technology_trend",
    ]);
    const totalShare = NEWSLETTER_SECTION_IDS.filter(
      (id) => result[id].count > 0,
    ).reduce((sum, id) => sum + result[id].share, 0);

    expect(totalShare).toBeCloseTo(1.0);
  });

  it("homeless intents do not count toward any section's share denominator", () => {
    const result = summarizeSectionCoverage(["competitor", "breaking"]);

    expect(result.competitiveLandscape.count).toBe(1);
    expect(result.competitiveLandscape.share).toBeCloseTo(1.0);
  });

  it("returns all zeros on empty input", () => {
    const result = summarizeSectionCoverage([]);
    for (const sectionId of NEWSLETTER_SECTION_IDS) {
      expect(result[sectionId].count).toBe(0);
      expect(result[sectionId].share).toBe(0);
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
