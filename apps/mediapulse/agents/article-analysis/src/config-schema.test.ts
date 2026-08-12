import {
  NEWSLETTER_SECTION_IDS,
  type AnalysisTickerContext,
} from "@workspace/agent-data-api-contract";
import { describe, expect, it } from "vitest";

import {
  ACCEPTANCE_CRITERIA_PLACEHOLDERS,
  articleAnalysisConfigSchema,
  flattenAcceptanceCriteria,
  substituteTickerPlaceholders,
} from "./config-schema.js";

const foreTicker: AnalysisTickerContext = {
  symbol: "FORE",
  name: "PT Fore Kopi Indonesia Tbk",
  sector: "Barang Konsumen Primer",
  industry: "Minuman",
  subIndustry: "Minuman Ringan",
  businessActivity: "Bisnis Kedai Kopi",
  aliases: ["Fore Coffee"],
  competitors: [
    { name: "Kopi Kenangan", aliases: ["Kenangan Brands"] },
    { name: "Tomoro Coffee", aliases: [] },
  ],
  regulators: [{ name: "BPOM", aliases: ["Badan POM"] }],
};

describe("articleAnalysisConfigSchema", () => {
  it("applies acceptance credential defaults", () => {
    const config = articleAnalysisConfigSchema.parse({});

    expect(config.acceptance).toEqual({
      model: "{{AI_MODEL}}",
      apiKey: "{{AI_API_KEY}}",
      baseUrl: "{{AI_BASE_URL}}",
    });
  });

  it("seeds one rule per canonical section", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const seededSections = config.acceptanceCriteria.map(
      (rule) => rule.section,
    );

    expect(seededSections).toEqual([...NEWSLETTER_SECTION_IDS]);
  });

  it("seeds at least five inclusion rules per section", () => {
    const config = articleAnalysisConfigSchema.parse({});

    for (const rule of config.acceptanceCriteria) {
      expect(rule.criteria.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("seeds globally unique, non-empty criterion ids", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const ids = flattenAcceptanceCriteria(config.acceptanceCriteria).map(
      (criterion) => criterion.id,
    );

    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps operator-provided acceptanceCriteria overrides", () => {
    const config = articleAnalysisConfigSchema.parse({
      acceptanceCriteria: [
        {
          section: "competitiveLandscape",
          criteria: [
            {
              id: "cl-custom",
              text: "Include if a rival launches a product.",
              qualifying: false,
            },
          ],
        },
      ],
    });

    expect(config.acceptanceCriteria).toEqual([
      {
        section: "competitiveLandscape",
        criteria: [
          {
            id: "cl-custom",
            text: "Include if a rival launches a product.",
            qualifying: false,
          },
        ],
      },
    ]);
  });

  it("marks a gate of at least two qualifying rules in every seeded section", () => {
    const config = articleAnalysisConfigSchema.parse({});

    for (const rule of config.acceptanceCriteria) {
      const gate = rule.criteria.filter((criterion) => criterion.qualifying);

      expect(gate.length).toBeGreaterThanOrEqual(2);
      expect(gate.length).toBeLessThan(rule.criteria.length);
    }
  });

  it("rejects a section rule with no criteria", () => {
    expect(() =>
      articleAnalysisConfigSchema.parse({
        acceptanceCriteria: [{ section: "quickHits", criteria: [] }],
      }),
    ).toThrow();
  });

  it("rejects unknown top-level keys", () => {
    expect(() =>
      articleAnalysisConfigSchema.parse({ scoring: { weight: 1 } }),
    ).toThrow();
  });

  it("rejects unknown section ids in acceptanceCriteria", () => {
    expect(() =>
      articleAnalysisConfigSchema.parse({
        acceptanceCriteria: [
          {
            section: "notASection",
            criteria: [{ id: "x", text: "y", qualifying: false }],
          },
        ],
      }),
    ).toThrow();
  });
});

describe("substituteTickerPlaceholders", () => {
  it("substitutes every placeholder from a fully populated ticker", () => {
    const resolved = substituteTickerPlaceholders(
      "{{TICKER}} ({{TICKER_NAME}}) in {{INDUSTRY}}/{{SUB_INDUSTRY}} under {{SECTOR}}, doing {{BUSINESS_ACTIVITY}}",
      foreTicker,
    );

    expect(resolved).toBe(
      "FORE (PT Fore Kopi Indonesia Tbk) in Minuman/Minuman Ringan under Barang Konsumen Primer, doing Bisnis Kedai Kopi",
    );
  });

  it("falls back to a generic phrase for a null field", () => {
    const resolved = substituteTickerPlaceholders(
      "specific to {{INDUSTRY}}, not the broad {{SECTOR}} sector",
      { ...foreTicker, industry: null, sector: null },
    );

    expect(resolved).toBe(
      "specific to the issuer's industry, not the broad overall sector",
    );
  });

  it("falls back for every placeholder when the ticker context is null", () => {
    const resolved = substituteTickerPlaceholders(
      "{{TICKER}} in {{INDUSTRY}} ({{SUB_INDUSTRY}})",
      null,
    );

    expect(resolved).toBe(
      "the issuer in the issuer's industry (the issuer's product market)",
    );
  });

  it("substitutes repeated occurrences of the same placeholder", () => {
    const resolved = substituteTickerPlaceholders(
      "{{TICKER}} and {{TICKER}} again",
      foreTicker,
    );

    expect(resolved).toBe("FORE and FORE again");
  });

  it("maps every placeholder field to a real ticker-context key", () => {
    const tickerKeys = new Set(Object.keys(foreTicker));

    for (const placeholder of ACCEPTANCE_CRITERIA_PLACEHOLDERS) {
      expect(tickerKeys.has(placeholder.field)).toBe(true);
    }
  });

  it("renders aliases as a plain list", () => {
    const resolved = substituteTickerPlaceholders(
      "brands: {{ALIASES}}",
      foreTicker,
    );

    expect(resolved).toBe("brands: Fore Coffee");
  });

  it("renders competitors with the spellings they appear under", () => {
    const resolved = substituteTickerPlaceholders(
      "peers: {{COMPETITORS}}",
      foreTicker,
    );

    expect(resolved).toBe(
      "peers: Kopi Kenangan (Kenangan Brands), Tomoro Coffee",
    );
  });

  it("falls back when the profile carries no aliases or competitors", () => {
    const resolved = substituteTickerPlaceholders(
      "brands: {{ALIASES}}; peers: {{COMPETITORS}}",
      { ...foreTicker, aliases: [], competitors: [] },
    );

    expect(resolved).toBe(
      "brands: no other known trading names; peers: no named peers on file",
    );
  });

  it("falls back for the list placeholders when the ticker context is null", () => {
    const resolved = substituteTickerPlaceholders(
      "brands: {{ALIASES}}; peers: {{COMPETITORS}}",
      null,
    );

    expect(resolved).toBe(
      "brands: no other known trading names; peers: no named peers on file",
    );
  });
});

describe("acceptanceCriteria default placeholders", () => {
  it("uses only declared placeholder tokens in the seeded rule text", () => {
    const config = articleAnalysisConfigSchema.parse({});
    const declaredTokens = new Set<string>(
      ACCEPTANCE_CRITERIA_PLACEHOLDERS.map((placeholder) => placeholder.token),
    );
    const usedTokens = flattenAcceptanceCriteria(
      config.acceptanceCriteria,
    ).flatMap((criterion) => criterion.text.match(/\{\{[^}]+\}\}/g) ?? []);

    for (const token of usedTokens) {
      expect(declaredTokens.has(token)).toBe(true);
    }
  });
});

describe("flattenAcceptanceCriteria", () => {
  it("tags every criterion with its section, in config order", () => {
    const flat = flattenAcceptanceCriteria([
      {
        section: "industryPulse",
        criteria: [
          { id: "ip1", text: "a", qualifying: false },
          { id: "ip2", text: "b", qualifying: false },
        ],
      },
      {
        section: "quickHits",
        criteria: [{ id: "qh1", text: "c", qualifying: false }],
      },
    ]);

    expect(flat).toEqual([
      { id: "ip1", section: "industryPulse", text: "a", qualifying: false },
      { id: "ip2", section: "industryPulse", text: "b", qualifying: false },
      { id: "qh1", section: "quickHits", text: "c", qualifying: false },
    ]);
  });
});
