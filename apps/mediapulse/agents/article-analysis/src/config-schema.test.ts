import { MEDIAPULSE_NEWSLETTER_SECTIONS } from "@workspace/agent-data-api-contract";
import { describe, expect, it } from "vitest";

import { articleAnalysisConfigSchema } from "./config-schema.js";

describe("articleAnalysisConfigSchema", () => {
  it("applies acceptance credential defaults", () => {
    const config = articleAnalysisConfigSchema.parse({});

    expect(config.acceptance).toEqual({
      model: "{{AI_MODEL}}",
      apiKey: "{{AI_API_KEY}}",
      baseUrl: "{{AI_BASE_URL}}",
    });
  });

  it("seeds acceptanceCriteria from the canonical sections", () => {
    const config = articleAnalysisConfigSchema.parse({});

    expect(config.acceptanceCriteria).toEqual(
      MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => ({
        section: section.id,
        criteria: section.description,
      })),
    );
  });

  it("keeps operator-provided acceptanceCriteria overrides", () => {
    const config = articleAnalysisConfigSchema.parse({
      acceptanceCriteria: [
        { section: "competitiveLandscape", criteria: "Only rival launches." },
      ],
    });

    expect(config.acceptanceCriteria).toEqual([
      { section: "competitiveLandscape", criteria: "Only rival launches." },
    ]);
  });

  it("rejects unknown top-level keys", () => {
    expect(() =>
      articleAnalysisConfigSchema.parse({ scoring: { weight: 1 } }),
    ).toThrow();
  });

  it("rejects unknown section ids in acceptanceCriteria", () => {
    expect(() =>
      articleAnalysisConfigSchema.parse({
        acceptanceCriteria: [{ section: "notASection", criteria: "x" }],
      }),
    ).toThrow();
  });
});
