import { NEWSLETTER_SECTION_IDS } from "@workspace/agent-data-api-contract";
import { describe, expect, it } from "vitest";

import {
  articleAnalysisConfigSchema,
  flattenAcceptanceCriteria,
} from "./config-schema.js";

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
            { id: "cl-custom", text: "Include if a rival launches a product." },
          ],
        },
      ],
    });

    expect(config.acceptanceCriteria).toEqual([
      {
        section: "competitiveLandscape",
        criteria: [
          { id: "cl-custom", text: "Include if a rival launches a product." },
        ],
      },
    ]);
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
          { section: "notASection", criteria: [{ id: "x", text: "y" }] },
        ],
      }),
    ).toThrow();
  });
});

describe("flattenAcceptanceCriteria", () => {
  it("tags every criterion with its section, in config order", () => {
    const flat = flattenAcceptanceCriteria([
      {
        section: "industryPulse",
        criteria: [
          { id: "ip1", text: "a" },
          { id: "ip2", text: "b" },
        ],
      },
      {
        section: "quickHits",
        criteria: [{ id: "qh1", text: "c" }],
      },
    ]);

    expect(flat).toEqual([
      { id: "ip1", section: "industryPulse", text: "a" },
      { id: "ip2", section: "industryPulse", text: "b" },
      { id: "qh1", section: "quickHits", text: "c" },
    ]);
  });
});
