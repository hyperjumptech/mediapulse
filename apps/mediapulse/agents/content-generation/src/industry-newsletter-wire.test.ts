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
  type IndustryNewsletterResolved,
} from "./industry-newsletter-urls.js";
import { parseIndustryNewsletterWire } from "@workspace/email-templates/parse-industry-newsletter-wire";

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

describe("industryNewsletterStructureSchema — industryPulse articleIndex", () => {
  it("accepts industryPulse without articleIndex", () => {
    const parsed = industryNewsletterStructureSchema.safeParse({
      subject: "S",
      industryPulse: { displayHeading: "L", prose: "p" },
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [
          { title: "T1", text: "b1" },
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
      disruptorsOrTech: { format: "prose", displayHeading: "X", prose: "pr" },
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
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.industryPulse.articleIndex).toBeUndefined();
    }
  });

  it("accepts industryPulse with a valid articleIndex", () => {
    const parsed = industryNewsletterStructureSchema.safeParse({
      subject: "S",
      industryPulse: { displayHeading: "L", prose: "p", articleIndex: 2 },
      competitiveLandscape: {
        displayHeading: "C",
        bullets: [
          { title: "T1", text: "b1" },
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
      disruptorsOrTech: { format: "prose", displayHeading: "X", prose: "pr" },
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
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.industryPulse.articleIndex).toBe(2);
    }
  });
});

describe("attachIndustryNewsletterSourceUrls", () => {
  const briefing = industryNewsletterStructureSchema.parse({
    subject: "S",
    industryPulse: { displayHeading: "L", prose: "p" },
    competitiveLandscape: {
      displayHeading: "C",
      bullets: [
        { title: "T1", text: "b1", articleIndex: 1 },
        { title: "T2", text: "b2", articleIndex: 99 },
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
      format: "bullets",
      displayHeading: "X",
      bullets: [{ title: "T5", text: "x", articleIndex: 2 }],
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

  it("maps articleIndex values to URLs and leaves bad indices without URLs", () => {
    const sources = [
      { url: "https://one.example" },
      { url: "  https://two.example  " },
    ];
    const resolved = attachIndustryNewsletterSourceUrls(briefing, sources);
    expect(resolved.competitiveLandscape).toBeDefined();
    expect(resolved.disruptorsOrTech).toBeDefined();
    const competitiveLandscape = resolved.competitiveLandscape!;
    const disruptorsOrTech = resolved.disruptorsOrTech!;

    expect(competitiveLandscape.bullets[0]?.url).toBe("https://one.example");
    expect(competitiveLandscape.bullets[1]?.url).toBeUndefined();
    expect(disruptorsOrTech.format).toBe("bullets");
    if (disruptorsOrTech.format === "bullets") {
      expect(disruptorsOrTech.bullets[0]?.url).toBe("https://two.example");
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
  it("starts with the wire marker and emits read lines with item titles", () => {
    const resolved = attachIndustryNewsletterSourceUrls(
      industryNewsletterStructureSchema.parse({
        subject: "S",
        industryPulse: { displayHeading: "L", prose: "p" },
        competitiveLandscape: {
          displayHeading: "C",
          bullets: [
            { title: "Rival A Launches", text: "b1", articleIndex: 1 },
            { title: "Rival B Expands", text: "b2", articleIndex: 1 },
          ],
        },
        dealsAndMovements: {
          displayHeading: "D",
          bullets: [{ title: "Deal Closed", text: "d1" }],
        },
        regulatoryPolicyWatch: {
          displayHeading: "R",
          bullets: [{ title: "New Rule", text: "r1" }],
        },
        disruptorsOrTech: {
          format: "prose",
          displayHeading: "X",
          prose: "pr",
        },
        quickHits: {
          displayHeading: "Q",
          items: [
            { title: "Hit One", text: "h1", articleIndex: 1 },
            { title: "Hit Two", text: "h2", articleIndex: 1 },
            { title: "Hit Three", text: "h3", articleIndex: 1 },
            { title: "Hit Four", text: "h4", articleIndex: 1 },
            { title: "Hit Five", text: "h5", articleIndex: 1 },
          ],
        },
      }),
      [{ url: "https://src.example" }],
    );

    const wire = formatIndustryNewsletterWire(resolved);

    expect(wire.startsWith(`${INDUSTRY_NEWSLETTER_WIRE_MARKER}\n`)).toBe(true);
    expect(wire).toContain("TITLE Rival A Launches");
    expect(wire).toContain("TITLE Hit One");
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
              title: "Rivals Underbid",
              text: "Rivals underbid on packages but the consortium still won (Article 1).",
              articleIndex: 1,
            },
            {
              title: "Fleet Oversupply",
              text: "Fleet oversupply is squeezing day-rate spreads across contractors (Article 4).",
              articleIndex: 2,
            },
          ],
        },
        dealsAndMovements: {
          displayHeading: "Deals",
          bullets: [
            {
              title: "Award Locks Revenue",
              text: "The award locks in multi-year revenue  (article  12).",
              articleIndex: 2,
            },
          ],
        },
        regulatoryPolicyWatch: {
          displayHeading: "Policy",
          bullets: [
            {
              title: "Permit Acceleration",
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
              title: "Electricity Pricing",
              text: "Electricity pricing is the gating item for new capacity (Article 2).",
              articleIndex: 2,
            },
          ],
        },
        quickHits: {
          displayHeading: "Quick hits",
          items: [
            {
              title: "Consortium Signs Dredging Package",
              text: "Consortium signed the dredging package (Article 1).",
              articleIndex: 1,
            },
            {
              title: "JV Delays on Tariff Talks",
              text: "JV pushed startup as tariff talks dragged (Article 2).",
              articleIndex: 2,
            },
            {
              title: "Export Levy Splits Peers",
              text: "Export levy split plantation peers (Article 3).",
              articleIndex: 1,
            },
            {
              title: "Equipment Spreads Narrow",
              text: "Equipment spreads narrowed (Article 4).",
              articleIndex: 2,
            },
            {
              title: "Industrial Permits on Fast Track",
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

  it("omits absent sections and preserves order of survivors", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: { displayHeading: "L", prose: "p" },
      competitiveLandscape: undefined,
      dealsAndMovements: {
        displayHeading: "D",
        bullets: [{ text: "d1" }],
      },
      regulatoryPolicyWatch: undefined,
      disruptorsOrTech: {
        format: "bullets",
        displayHeading: "X",
        bullets: [{ text: "x1" }],
      },
      quickHits: {
        displayHeading: "Q",
        items: [
          { text: "h1" },
          { text: "h2" },
          { text: "h3" },
          { text: "h4" },
          { text: "h5" },
        ],
      },
    };

    const wire = formatIndustryNewsletterWire(resolved);

    expect(wire).not.toContain("BEGIN competitive-landscape");
    expect(wire).not.toContain("BEGIN regulatory-policy-watch");
    expect(wire).toContain("BEGIN deals-and-movements");
    expect(wire).toContain("BEGIN disruptors-or-tech");
    expect(wire).toContain("BEGIN quick-hits");
    const dealsIndex = wire.indexOf("BEGIN deals-and-movements");
    const disruptorsIndex = wire.indexOf("BEGIN disruptors-or-tech");
    const quickHitsIndex = wire.indexOf("BEGIN quick-hits");
    expect(dealsIndex).toBeLessThan(disruptorsIndex);
    expect(disruptorsIndex).toBeLessThan(quickHitsIndex);
  });

  it("round-trips a partial briefing through the parser with sections in order", () => {
    const resolved = attachIndustryNewsletterSourceUrls(
      industryNewsletterStructureSchema.parse({
        subject: "S",
        industryPulse: { displayHeading: "Lead", prose: "Pulse prose." },
        competitiveLandscape: {
          displayHeading: "C",
          bullets: [
            { title: "T1", text: "c1", articleIndex: 1 },
            { title: "T2", text: "c2" },
          ],
        },
        dealsAndMovements: {
          displayHeading: "Deals",
          bullets: [{ title: "T3", text: "d1" }],
        },
        regulatoryPolicyWatch: {
          displayHeading: "R",
          bullets: [{ title: "T4", text: "r1" }],
        },
        disruptorsOrTech: {
          format: "prose",
          displayHeading: "X",
          prose: "disruptor prose",
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
      [{ url: "https://src.example" }],
    );

    const partial: IndustryNewsletterResolved = {
      subject: resolved.subject,
      industryPulse: resolved.industryPulse,
      dealsAndMovements: resolved.dealsAndMovements,
      quickHits: resolved.quickHits,
    };

    const wire = formatIndustryNewsletterWire(partial);
    const parsed = parseIndustryNewsletterWire(wire);

    expect(parsed).not.toBeUndefined();
    expect(parsed?.format).toBe("industry");
    const keys = parsed?.sections.map((s) => s.machineKey);
    expect(keys).toEqual([
      "industry-pulse",
      "deals-and-movements",
      "quick-hits",
    ]);
  });

  it("emits a Read the full article line for a grounded lead and the parser peels it into url", () => {
    const resolved = attachIndustryNewsletterSourceUrls(
      industryNewsletterStructureSchema.parse({
        subject: "S",
        industryPulse: {
          displayHeading: "Lead",
          prose: "Grounded prose.",
          articleIndex: 1,
        },
        competitiveLandscape: {
          displayHeading: "C",
          bullets: [
            { title: "T1", text: "c1", articleIndex: 1 },
            { title: "T2", text: "c2", articleIndex: 1 },
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
        disruptorsOrTech: { format: "prose", displayHeading: "X", prose: "pr" },
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
      [{ url: "https://lead.example" }],
    );

    expect(resolved.industryPulse?.url).toBe("https://lead.example");

    const wire = formatIndustryNewsletterWire(resolved);
    expect(wire).toContain("Grounded prose.");
    expect(wire).toContain("Read the full article: https://lead.example");

    const parsed = parseIndustryNewsletterWire(wire);
    const pulseSection = parsed?.sections.find(
      (s) => s.machineKey === "industry-pulse",
    );
    expect(pulseSection).toBeDefined();
    if (pulseSection?.machineKey === "industry-pulse") {
      expect(pulseSection.prose).toBe("Grounded prose.");
      expect(pulseSection.url).toBe("https://lead.example");
    }
  });

  it("omits industry-pulse when the resolved lead is undefined", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      quickHits: {
        displayHeading: "Q",
        items: [{ text: "Hit one", url: "https://a.example" }],
      },
    };

    const wire = formatIndustryNewsletterWire(resolved);
    expect(wire).not.toContain("BEGIN industry-pulse");

    const parsed = parseIndustryNewsletterWire(wire);
    expect(
      parsed?.sections.every((s) => s.machineKey !== "industry-pulse"),
    ).toBe(true);
  });

  it("handles the degenerate case of industry-pulse plus a single quick-hit", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: { displayHeading: "L", prose: "Pulse prose." },
      quickHits: {
        displayHeading: "Q",
        items: [{ text: "Only hit" }],
      },
    };

    const wire = formatIndustryNewsletterWire(resolved);
    const parsed = parseIndustryNewsletterWire(wire);

    expect(wire.startsWith(`${INDUSTRY_NEWSLETTER_WIRE_MARKER}\n`)).toBe(true);
    expect(parsed).not.toBeUndefined();
    const keys = parsed?.sections.map((s) => s.machineKey);
    expect(keys).toEqual(["industry-pulse", "quick-hits"]);
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
            { title: "T1", text: "Clean bullet.", articleIndex: 1 },
            { title: "T2", text: "Second clean bullet.", articleIndex: 1 },
          ],
        },
        dealsAndMovements: {
          displayHeading: "D",
          bullets: [{ title: "T3", text: "Another clean bullet." }],
        },
        regulatoryPolicyWatch: {
          displayHeading: "R",
          bullets: [{ title: "T4", text: "Policy bullet." }],
        },
        disruptorsOrTech: {
          format: "prose",
          displayHeading: "X",
          prose: "Clean disruptor prose.",
        },
        quickHits: {
          displayHeading: "Q",
          items: [
            { title: "Q1", text: "Hit one", articleIndex: 1 },
            { title: "Q2", text: "Hit two", articleIndex: 1 },
            { title: "Q3", text: "Hit three", articleIndex: 1 },
            { title: "Q4", text: "Hit four", articleIndex: 1 },
            { title: "Q5", text: "Hit five", articleIndex: 1 },
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
