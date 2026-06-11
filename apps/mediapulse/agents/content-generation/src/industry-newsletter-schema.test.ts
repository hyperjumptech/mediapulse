import { describe, expect, it } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import { NEWSLETTER_SECTION_IDS } from "@workspace/agent-data-api-contract";

import {
  industryNewsletterStructureLlmSchema,
  industryNewsletterStructureSchema,
} from "./industry-newsletter-schema.js";

/** Finds JSON-schema objects whose `properties` keys are not all listed in `required`. */
const findOpenAiStrictSchemaIssues = (
  value: unknown,
  path = "root",
): string[] => {
  if (!value || typeof value !== "object") {
    return [];
  }

  const issues: string[] = [];
  const record = value as Record<string, unknown>;

  if (
    record.type === "object" &&
    record.properties &&
    typeof record.properties === "object" &&
    Array.isArray(record.required)
  ) {
    const propertyKeys = Object.keys(
      record.properties as Record<string, unknown>,
    );
    const missing = propertyKeys.filter(
      (key) => !(record.required as string[]).includes(key),
    );
    if (missing.length > 0) {
      issues.push(`${path}: missing in required: ${missing.join(", ")}`);
    }
  }

  for (const [key, nested] of Object.entries(record)) {
    issues.push(...findOpenAiStrictSchemaIssues(nested, `${path}.${key}`));
  }

  return issues;
};

describe("industryNewsletterStructureSchema", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = industryNewsletterStructureSchema.parse({
      subject: "S",
      industryPulse: { displayHeading: "L", prose: "p" },
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [
          { title: "T1", text: "b1", articleIndex: 1 },
          { title: "T2", text: "b2" },
        ],
      },
      dealsAndMovements: {
        displayHeading: "D",
        bullets: [{ title: "T3", text: "d1" }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "R",
        bullets: [{ title: "T4", text: "r1" }],
      },
      disruptorsOrTech: {
        format: "prose",
        displayHeading: "X",
        prose: "pr",
      },
      quickHits: {
        displayHeading: "Q",
        items: [
          { title: "Q1", text: "h1", articleIndex: 1 },
          { title: "Q2", text: "h2", articleIndex: 2 },
          { title: "Q3", text: "h3", articleIndex: 1 },
          { title: "Q4", text: "h4", articleIndex: 2 },
          { title: "Q5", text: "h5", articleIndex: 1 },
        ],
      },
    });

    expect(parsed.subject).toBe("S");
    expect(parsed.quickHits.items).toHaveLength(5);
  });

  it("rejects fewer than two competitive bullets", () => {
    expect(() =>
      industryNewsletterStructureSchema.parse({
        subject: "S",
        industryPulse: { displayHeading: "L", prose: "p" },
        competitiveLandscape: {
          displayHeading: "C",
          bullets: [{ title: "T1", text: "only", articleIndex: 1 }],
        },
        dealsAndMovements: {
          displayHeading: "D",
          bullets: [{ title: "T2", text: "d1" }],
        },
        regulatoryPolicyWatch: {
          displayHeading: "R",
          bullets: [{ title: "T3", text: "r1" }],
        },
        disruptorsOrTech: {
          format: "bullets",
          displayHeading: "X",
          bullets: [{ title: "T4", text: "b" }],
        },
        quickHits: {
          displayHeading: "Q",
          items: [
            { title: "Q1", text: "h1", articleIndex: 1 },
            { title: "Q2", text: "h2", articleIndex: 1 },
            { title: "Q3", text: "h3", articleIndex: 1 },
            { title: "Q4", text: "h4", articleIndex: 1 },
            { title: "Q5", text: "h5", articleIndex: 1 },
          ],
        },
      }),
    ).toThrow();
  });
});

describe("industryNewsletterStructureSchema section drift guard", () => {
  it("has exactly the same section keys as NEWSLETTER_SECTION_IDS", () => {
    const schemaKeys = Object.keys(
      industryNewsletterStructureSchema.shape,
    ).filter((key) => key !== "subject");

    expect(new Set(schemaKeys)).toEqual(new Set(NEWSLETTER_SECTION_IDS));
  });
});

describe("industryNewsletterStructureLlmSchema", () => {
  it("is compatible with OpenAI strict JSON schema required-key rules", () => {
    const jsonSchema = zodToJsonSchema(industryNewsletterStructureLlmSchema, {
      $refStrategy: "none",
    });

    expect(findOpenAiStrictSchemaIssues(jsonSchema)).toEqual([]);
  });

  it("normalizes nullable articleIndex and optional blocks to the parsed shape", () => {
    const parsed = industryNewsletterStructureLlmSchema.parse({
      subject: "S",
      industryPulse: { displayHeading: "L", prose: "p", articleIndex: null },
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [
          { title: "T1", text: "b1", articleIndex: 1 },
          { title: "T2", text: "b2", articleIndex: null },
        ],
      },
      dealsAndMovements: {
        displayHeading: "D",
        bullets: [{ title: "T3", text: "d1", articleIndex: null }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "R",
        bullets: [{ title: "T4", text: "r1", articleIndex: 2 }],
      },
      disruptorsOrTech: {
        format: "prose",
        displayHeading: "X",
        prose: "pr",
      },
      quickHits: {
        displayHeading: "Q",
        items: [
          { title: "Q1", text: "h1", articleIndex: 1 },
          { title: "Q2", text: "h2", articleIndex: 2 },
          { title: "Q3", text: "h3", articleIndex: 1 },
          { title: "Q4", text: "h4", articleIndex: 2 },
          { title: "Q5", text: "h5", articleIndex: 1 },
        ],
      },
    });

    expect(industryNewsletterStructureSchema.parse(parsed)).toEqual(parsed);
    expect(parsed.competitiveLandscape.bullets[1]).toEqual({
      title: "T2",
      text: "b2",
    });
    expect(parsed.industryPulse.articleIndex).toBeUndefined();
  });
});
