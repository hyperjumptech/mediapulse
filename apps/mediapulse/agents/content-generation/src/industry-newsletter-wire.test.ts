import { describe, expect, it } from "vitest";

import {
  formatIndustryNewsletterV2Wire,
  INDUSTRY_NEWSLETTER_WIRE_V2_MARKER,
} from "./format-industry-newsletter-v2.js";
import { industryNewsletterStructureSchema } from "./industry-newsletter-schema.js";
import {
  attachIndustryNewsletterSourceUrls,
  resolveArticleUrlForIndustryNewsletter,
} from "./industry-newsletter-urls.js";

describe("resolveArticleUrlForIndustryNewsletter", () => {
  const sources = [{ url: "https://a.example" }, { url: "https://b.example" }];

  it("returns undefined for out-of-range indices", () => {
    expect(resolveArticleUrlForIndustryNewsletter(0, sources)).toBeUndefined();
    expect(resolveArticleUrlForIndustryNewsletter(3, sources)).toBeUndefined();
  });

  it("returns trimmed URL for in-range indices", () => {
    expect(resolveArticleUrlForIndustryNewsletter(1, sources)).toBe(
      "https://a.example",
    );
    expect(resolveArticleUrlForIndustryNewsletter(2, sources)).toBe(
      "https://b.example",
    );
  });
});

describe("attachIndustryNewsletterSourceUrls", () => {
  const briefing = industryNewsletterStructureSchema.parse({
    subject: "S",
    industryPulse: { displayHeading: "L", prose: "p" },
    competitiveLandscape: {
      displayHeading: "C",
      bullets: [
        { text: "b1", articleIndex: 1 },
        { text: "b2", articleIndex: 99 },
      ],
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
      bullets: [{ text: "x", articleIndex: 2 }],
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

  it("maps articleIndex values to URLs and leaves bad indices without URLs", () => {
    const sources = [
      { url: "https://one.example" },
      { url: "  https://two.example  " },
    ];
    const resolved = attachIndustryNewsletterSourceUrls(briefing, sources);

    expect(resolved.competitiveLandscape.bullets[0]?.url).toBe(
      "https://one.example",
    );
    expect(resolved.competitiveLandscape.bullets[1]?.url).toBeUndefined();
    expect(resolved.disruptorsOrTech.format).toBe("bullets");
    if (resolved.disruptorsOrTech.format === "bullets") {
      expect(resolved.disruptorsOrTech.bullets[0]?.url).toBe(
        "https://two.example",
      );
    }
  });
});

describe("formatIndustryNewsletterV2Wire", () => {
  it("starts with the v2 marker and emits read lines", () => {
    const resolved = attachIndustryNewsletterSourceUrls(
      industryNewsletterStructureSchema.parse({
        subject: "S",
        industryPulse: { displayHeading: "L", prose: "p" },
        competitiveLandscape: {
          displayHeading: "C",
          bullets: [
            { text: "b1", articleIndex: 1 },
            { text: "b2", articleIndex: 1 },
          ],
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
            { text: "h2", articleIndex: 1 },
            { text: "h3", articleIndex: 1 },
            { text: "h4", articleIndex: 1 },
            { text: "h5", articleIndex: 1 },
          ],
        },
      }),
      [{ url: "https://src.example" }],
    );

    const wire = formatIndustryNewsletterV2Wire(resolved);

    expect(wire.startsWith(`${INDUSTRY_NEWSLETTER_WIRE_V2_MARKER}\n`)).toBe(
      true,
    );
    expect(wire).toContain("Read the full article: https://src.example");
  });
});
