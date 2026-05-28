import { describe, expect, it } from "vitest";

import {
  formatIndustryNewsletterWire,
  INDUSTRY_NEWSLETTER_WIRE_MARKER,
  stripArticleMarkers,
} from "./format-industry-newsletter.js";
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

describe("stripArticleMarkers", () => {
  it("returns text unchanged when no marker is present", () => {
    // Setup
    const text = "Commodity exposure alone.";

    // Act
    const result = stripArticleMarkers(text);

    // Assert
    expect(result).toBe(text);
  });

  it("strips markers with varied spacing and case while preserving punctuation", () => {
    // Act
    const result = stripArticleMarkers(
      "Broadening commodity exposure alone (Article 3).",
    );

    // Assert
    expect(result).toBe("Broadening commodity exposure alone.");
    expect(stripArticleMarkers("Tail risk  (article  12).")).toBe("Tail risk.");
  });
});

describe("formatIndustryNewsletterWire", () => {
  it("starts with the wire marker and emits read lines", () => {
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

    const wire = formatIndustryNewsletterWire(resolved);

    expect(wire.startsWith(`${INDUSTRY_NEWSLETTER_WIRE_MARKER}\n`)).toBe(true);
    expect(wire).toContain("Read the full article: https://src.example");
  });

  it("strips inline article markers from wire content while preserving read lines", () => {
    // Setup
    const resolved = attachIndustryNewsletterSourceUrls(
      industryNewsletterStructureSchema.parse({
        subject: "S",
        industryPulse: {
          displayHeading: "Pulse",
          prose:
            "Sector tone stayed flat while miners broadened commodity exposure alone (Article 3).",
        },
        competitiveLandscape: {
          displayHeading: "Competition",
          bullets: [
            {
              text: "Rivals underbid on packages but the consortium still won (Article 1).",
              articleIndex: 1,
            },
            {
              text: "Fleet oversupply is squeezing day-rate spreads across contractors (Article 4).",
              articleIndex: 2,
            },
          ],
        },
        dealsAndMovements: {
          displayHeading: "Deals",
          bullets: [
            {
              text: "The award locks in multi-year revenue  (article  12).",
              articleIndex: 2,
            },
          ],
        },
        regulatoryPolicyWatch: {
          displayHeading: "Policy",
          bullets: [
            {
              text: "Permit acceleration usually precedes a civil-works spike (Article 5).",
              articleIndex: 1,
            },
          ],
        },
        disruptorsOrTech: {
          format: "bullets",
          displayHeading: "Tech",
          bullets: [
            {
              text: "Electricity pricing is the gating item for new capacity (Article 2).",
              articleIndex: 2,
            },
          ],
        },
        quickHits: {
          displayHeading: "Quick hits",
          items: [
            {
              text: "Consortium signed the dredging package (Article 1).",
              articleIndex: 1,
            },
            {
              text: "JV pushed startup as tariff talks dragged (Article 2).",
              articleIndex: 2,
            },
            {
              text: "Export levy split plantation peers (Article 3).",
              articleIndex: 1,
            },
            {
              text: "Equipment spreads narrowed (Article 4).",
              articleIndex: 2,
            },
            {
              text: "Industrial permits on a fast track (Article 5).",
              articleIndex: 1,
            },
          ],
        },
      }),
      [{ url: "https://one.example" }, { url: "https://two.example" }],
    );

    // Act
    const wire = formatIndustryNewsletterWire(resolved);

    // Assert
    expect(wire).not.toMatch(/\(Article/i);
    expect(wire).toContain(
      "Sector tone stayed flat while miners broadened commodity exposure alone.",
    );
    expect(wire).toContain("The award locks in multi-year revenue.");
    expect(wire).toContain("Read the full article: https://one.example");
    expect(wire).toContain("Read the full article: https://two.example");
  });

  it("is idempotent and leaves marker-free input unchanged on re-format", () => {
    // Setup
    const resolved = attachIndustryNewsletterSourceUrls(
      industryNewsletterStructureSchema.parse({
        subject: "S",
        industryPulse: {
          displayHeading: "L",
          prose: "Clean prose without markers.",
        },
        competitiveLandscape: {
          displayHeading: "C",
          bullets: [
            { text: "Clean bullet.", articleIndex: 1 },
            { text: "Second clean bullet.", articleIndex: 1 },
          ],
        },
        dealsAndMovements: {
          displayHeading: "D",
          bullets: [{ text: "Another clean bullet." }],
        },
        regulatoryPolicyWatch: {
          displayHeading: "R",
          bullets: [{ text: "Policy bullet." }],
        },
        disruptorsOrTech: {
          format: "prose",
          displayHeading: "X",
          prose: "Clean disruptor prose.",
        },
        quickHits: {
          displayHeading: "Q",
          items: [
            { text: "Hit one", articleIndex: 1 },
            { text: "Hit two", articleIndex: 1 },
            { text: "Hit three", articleIndex: 1 },
            { text: "Hit four", articleIndex: 1 },
            { text: "Hit five", articleIndex: 1 },
          ],
        },
      }),
      [{ url: "https://src.example" }],
    );

    // Act
    const wireOnce = formatIndustryNewsletterWire(resolved);
    const wireTwice = formatIndustryNewsletterWire(resolved);

    // Assert
    expect(wireTwice).toBe(wireOnce);
    expect(wireOnce).not.toMatch(/\(Article/i);
  });
});
