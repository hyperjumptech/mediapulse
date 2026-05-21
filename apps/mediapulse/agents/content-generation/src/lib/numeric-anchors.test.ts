import { afterEach, describe, expect, it, vi } from "vitest";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
import { logger } from "@workspace/logger";

import {
  applyNumericAnchorPolicy,
  auditNumbersInBriefing,
  extractNumericAnchorsFromSource,
  formatAnchorsForPrompt,
  selectTopAnchors,
} from "./numeric-anchors.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const minimalStructure = (
  patch: Partial<IndustryNewsletterStructure> = {},
): IndustryNewsletterStructure => ({
  subject: "Brief",
  industryPulse: { displayHeading: "Pulse", prose: "Lead." },
  competitiveLandscape: {
    displayHeading: "Competitive",
    bullets: [{ text: "B1" }],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ text: "D1" }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Regulatory",
    bullets: [{ text: "R1" }],
  },
  disruptorsOrTech: {
    format: "prose",
    displayHeading: "Disruptors",
    prose: "Tech note.",
  },
  quickHits: {
    displayHeading: "Quick",
    items: [
      { text: "h1", articleIndex: 1 },
      { text: "h2", articleIndex: 1 },
      { text: "h3", articleIndex: 1 },
      { text: "h4", articleIndex: 1 },
      { text: "h5", articleIndex: 1 },
    ],
  },
  ...patch,
});

describe("extractNumericAnchorsFromSource", () => {
  it("extracts currency and percent anchors from financial prose", () => {
    // Setup
    const body = "BCA reported Rp 12.4 trillion net profit, up 12.4% YoY";

    // Act
    const anchors = extractNumericAnchorsFromSource({ content: body }, 3);

    // Assert
    expect(anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw: "Rp 12.4 trillion",
          unit: "currency",
          salience: 1,
          articleIndex: 3,
        }),
        expect.objectContaining({
          raw: "12.4%",
          unit: "percent",
          salience: 1,
          articleIndex: 3,
        }),
      ]),
    );
  });

  it("extracts count anchors for branch openings", () => {
    // Setup
    const body = "The bank opened 8 new branches in Q1.";

    // Act
    const anchors = extractNumericAnchorsFromSource({ content: body }, 1);

    // Assert
    expect(anchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw: expect.stringMatching(/8 new branches/i),
          unit: "count",
          salience: 0.7,
        }),
      ]),
    );
  });
});

describe("selectTopAnchors", () => {
  it("caps per article and overall while preferring high salience", () => {
    // Setup
    const anchors = [
      {
        articleIndex: 1,
        raw: "12%",
        normalized: "12%",
        unit: "percent" as const,
        magnitude: 12,
        salience: 1,
        position: 10,
      },
      {
        articleIndex: 1,
        raw: "8 new branches",
        normalized: "8 new branches",
        unit: "count" as const,
        magnitude: 8,
        salience: 0.7,
        position: 50,
      },
      {
        articleIndex: 2,
        raw: "$2.3B",
        normalized: "$2.3B",
        unit: "currency" as const,
        magnitude: 2.3,
        salience: 1,
        position: 5,
      },
    ];

    // Act
    const selected = selectTopAnchors(anchors, 1, 2);

    // Assert
    expect(selected).toHaveLength(2);
    expect(selected.map((anchor) => anchor.raw)).toEqual(
      expect.arrayContaining(["12%", "$2.3B"]),
    );
  });
});

describe("formatAnchorsForPrompt", () => {
  it("renders verbatim contract with article indices", () => {
    // Act
    const block = formatAnchorsForPrompt([
      {
        articleIndex: 3,
        raw: "Rp 12.4 trillion",
        normalized: "Rp 12.4 trillion",
        unit: "currency",
        magnitude: 12.4,
        salience: 1,
      },
      {
        articleIndex: 7,
        raw: "$2.3B",
        normalized: "$2.3B",
        unit: "currency",
        magnitude: 2.3,
        salience: 1,
      },
    ]);

    // Assert
    expect(block).toContain("VERBATIM FIGURES AVAILABLE FROM SOURCES:");
    expect(block).toContain("- Rp 12.4 trillion (Article 3)");
    expect(block).toContain("- $2.3B (Article 7)");
    expect(block).toContain("use the EXACT string above");
  });
});

describe("auditNumbersInBriefing", () => {
  it("reports no unmatched figures when briefing quotes source text", () => {
    // Setup
    const sources = [
      {
        url: "https://example.com/a",
        title: "BCA",
        content: "BCA reported Rp 12.4 trillion net profit.",
      },
    ];
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { text: "BCA grew net profit to Rp 12.4 trillion", articleIndex: 1 },
        ],
      },
    });
    const topAnchors = extractNumericAnchorsFromSource(sources[0]!, 1);

    // Act
    const report = auditNumbersInBriefing(
      structure,
      sources,
      topAnchors,
      topAnchors.length,
    );

    // Assert
    expect(report.unmatchedFigures).toEqual([]);
  });

  it("flags figures absent from all source bodies", () => {
    // Setup
    const sources = [
      {
        url: "https://example.com/a",
        title: "BCA",
        content: "BCA reported Rp 11 trillion net profit.",
      },
    ];
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { text: "BCA grew net profit to Rp 12.4 trillion", articleIndex: 1 },
        ],
      },
    });

    // Act
    const report = auditNumbersInBriefing(structure, sources, [], 0);

    // Assert
    expect(report.unmatchedFigures).toEqual(["Rp 12.4 trillion"]);
  });
});

describe("applyNumericAnchorPolicy — strip", () => {
  it("replaces unmatched figures and supports numeric_stripped logging", () => {
    // Setup
    const infoSpy = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined);
    const sources = [
      {
        url: "https://example.com/a",
        title: "BCA",
        content: "BCA reported Rp 11 trillion net profit.",
      },
    ];
    const structure = minimalStructure({
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ text: "Net profit hit Rp 12.4 trillion last quarter" }],
      },
    });

    // Act
    const applied = applyNumericAnchorPolicy(
      structure,
      sources,
      [],
      0,
      "strip",
    );
    for (const figure of applied.strippedFigures) {
      logger.info(
        { event: "numeric_stripped", figure },
        "Numeric figure stripped",
      );
    }

    // Assert
    expect(applied.structure.dealsAndMovements.bullets[0]?.text).toBe(
      "Net profit hit [figure removed] last quarter",
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "numeric_stripped",
        figure: "Rp 12.4 trillion",
      }),
      expect.any(String),
    );
  });
});
