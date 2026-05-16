import { describe, expect, it } from "vitest";

import { industryNewsletterStructureSchema } from "./industry-newsletter-schema.js";

describe("industryNewsletterStructureSchema", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = industryNewsletterStructureSchema.parse({
      subject: "S",
      industryPulse: { displayHeading: "L", prose: "p" },
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [{ text: "b1", articleIndex: 1 }, { text: "b2" }],
      },
      dealsAndMovements: {
        displayHeading: "D",
        bullets: [{ text: "d1" }],
      },
      regulatoryPolicyWatch: {
        displayHeading: "R",
        bullets: [{ text: "r1" }],
      },
      disruptorsOrTech: {
        format: "prose",
        displayHeading: "X",
        prose: "pr",
      },
      quickHits: {
        displayHeading: "Q",
        items: [
          { text: "h1", articleIndex: 1 },
          { text: "h2", articleIndex: 2 },
          { text: "h3", articleIndex: 1 },
          { text: "h4", articleIndex: 2 },
          { text: "h5", articleIndex: 1 },
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
          bullets: [{ text: "only", articleIndex: 1 }],
        },
        dealsAndMovements: {
          displayHeading: "D",
          bullets: [{ text: "d1" }],
        },
        regulatoryPolicyWatch: {
          displayHeading: "R",
          bullets: [{ text: "r1" }],
        },
        disruptorsOrTech: {
          format: "bullets",
          displayHeading: "X",
          bullets: [{ text: "b" }],
        },
        quickHits: {
          displayHeading: "Q",
          items: [
            { text: "h1", articleIndex: 1 },
            { text: "h2", articleIndex: 1 },
            { text: "h3", articleIndex: 1 },
            { text: "h4", articleIndex: 1 },
            { text: "h5", articleIndex: 1 },
          ],
        },
      }),
    ).toThrow();
  });
});
