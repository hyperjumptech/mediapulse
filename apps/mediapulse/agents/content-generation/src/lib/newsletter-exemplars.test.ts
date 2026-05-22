import { describe, expect, it } from "vitest";

import {
  buildExemplarPromptSection,
  detectExemplarPlagiarism,
  fitSourcesForExemplarBudget,
  formatExemplarBlock,
  jaccardSimilarity,
  matchesConsumerFinancialKeywords,
  NEWSLETTER_EXEMPLAR_BANK,
  pickExemplarsForTicker,
  tokenizeForJaccard,
} from "./newsletter-exemplars.js";
import type { SourceForGeneration } from "../types.js";

const source = (title: string): SourceForGeneration => ({
  url: "https://example.com/story",
  title,
  content: "Body text.",
});

describe("pickExemplarsForTicker", () => {
  it("selects consumer exemplar for bank and lending keywords", () => {
    // Setup
    const sources = [
      source("Retail lending growth holds"),
      source("Deposits stable"),
    ];

    // Act
    const picked = pickExemplarsForTicker("BBCA", "Bank Central Asia", sources);

    // Assert
    expect(picked).toHaveLength(1);
    expect(picked[0]?.id).toBe("consumer-CONSM");
    expect(picked[0]?.sectorTag).toBe("consumer");
  });

  it("selects industrial exemplar for mining and palm oil keywords", () => {
    // Setup
    const sources = [
      source("Mining output rises in Kalimantan"),
      source("Palm oil export levy under review"),
    ];

    // Act
    const picked = pickExemplarsForTicker(
      "ASII",
      "Astra International",
      sources,
    );

    // Assert
    expect(picked).toHaveLength(1);
    expect(picked[0]?.id).toBe("industrial-INDX");
    expect(picked[0]?.sectorTag).toBe("industrial");
  });

  it("honors explicit sectorTag over keyword heuristics", () => {
    // Setup
    const sources = [source("Retail lending growth holds")];

    // Act
    const picked = pickExemplarsForTicker(
      "BBCA",
      "Bank Central Asia",
      sources,
      { sectorTag: "industrial" },
    );

    // Assert
    expect(picked[0]?.id).toBe("industrial-INDX");
  });

  it("returns two exemplars when maxExemplars is 2", () => {
    // Act
    const picked = pickExemplarsForTicker("INDX", "Indo Nexus", [], {
      maxExemplars: 2,
    });

    // Assert
    expect(picked).toHaveLength(2);
    expect(picked.map((exemplar) => exemplar.id)).toEqual([
      "industrial-INDX",
      "consumer-CONSM",
    ]);
  });
});

describe("formatExemplarBlock", () => {
  it("renders prose-anchored blocks with start and end markers", () => {
    // Act
    const block = formatExemplarBlock(NEWSLETTER_EXEMPLAR_BANK[0]!);

    // Assert
    expect(block.startsWith("EXEMPLAR — industrial sector")).toBe(true);
    expect(block).toContain("END EXEMPLAR");
    expect(block).toContain("Competitive Landscape /");
    expect(block).toContain("(cited Article 1)");
  });

  it("buildExemplarPromptSection prepends the anti-plagiarism disclaimer", () => {
    // Act
    const section = buildExemplarPromptSection([NEWSLETTER_EXEMPLAR_BANK[0]!]);

    // Assert
    expect(section).toContain("Do NOT copy specific facts");
    expect(section).toContain("EXEMPLAR — industrial sector");
  });
});

describe("matchesConsumerFinancialKeywords", () => {
  it("matches finance-related haystacks", () => {
    // Assert
    expect(matchesConsumerFinancialKeywords("bank central lending")).toBe(true);
    expect(matchesConsumerFinancialKeywords("nickel smelter mining")).toBe(
      false,
    );
  });
});

describe("fitSourcesForExemplarBudget", () => {
  it("drops tail sources before exemplars when combined chars exceed cap", () => {
    // Setup
    const exemplarSection = "x".repeat(500);
    const sources = [
      { url: "https://a", title: "A", content: "a".repeat(400) },
      { url: "https://b", title: "B", content: "b".repeat(400) },
      { url: "https://c", title: "C", content: "c".repeat(400) },
    ];

    // Act
    const fitted = fitSourcesForExemplarBudget(sources, exemplarSection, 900);

    // Assert
    expect(fitted.sources).toHaveLength(1);
    expect(fitted.sourcesDroppedForExemplarSpace).toBe(2);
  });
});

describe("detectExemplarPlagiarism", () => {
  it("flags high Jaccard overlap against exemplar bullets", () => {
    // Setup
    const exemplar = NEWSLETTER_EXEMPLAR_BANK[0]!;
    const copiedBullet = exemplar.output.competitiveLandscape.bullets[0]!;

    // Act
    const result = detectExemplarPlagiarism(
      {
        ...exemplar.output,
        competitiveLandscape: {
          ...exemplar.output.competitiveLandscape,
          bullets: [copiedBullet, copiedBullet],
        },
      },
      exemplar,
    );

    // Assert
    expect(result.maxSimilarity).toBeGreaterThan(0.6);
    expect(result.possiblyPlagiarized).toBe(true);
  });

  it("does not flag unrelated generated bullets", () => {
    // Setup
    const exemplar = NEWSLETTER_EXEMPLAR_BANK[0]!;
    const unrelated: typeof exemplar.output = {
      subject: "Weekly sector scan",
      industryPulse: {
        displayHeading: "Neutral week",
        prose: "No major shifts appeared across suppliers this week.",
      },
      competitiveLandscape: {
        displayHeading: "Share shifts",
        bullets: [
          {
            text: "Widget exporters in Vietnam reported steady shipment volumes without pricing concessions to distributors overseas.",
            articleIndex: 1,
          },
          {
            text: "Clinic software vendors saw pilot expansions but no consolidation deals among regional hospital groups.",
            articleIndex: 2,
          },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deal tape",
        bullets: [
          {
            text: "A small logistics tuck-in closed at undisclosed terms without strategic impact on sector leaders.",
            articleIndex: 3,
          },
        ],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Policy",
        bullets: [
          {
            text: "Draft telecom rules stayed in consultation with no enforcement timeline published yet.",
            articleIndex: 1,
          },
        ],
      },
      disruptorsOrTech: {
        format: "prose",
        displayHeading: "Tech",
        prose:
          "Robotics pilots remained limited to warehouse trials without commercial rollouts.",
      },
      quickHits: {
        displayHeading: "Hits",
        items: [
          { text: "Widget exports steady", articleIndex: 1 },
          { text: "Clinic pilots expanded", articleIndex: 2 },
          { text: "Logistics tuck-in closed", articleIndex: 3 },
          { text: "Telecom draft unchanged", articleIndex: 1 },
          { text: "Robotics trials only", articleIndex: 2 },
        ],
      },
    };

    // Act
    const result = detectExemplarPlagiarism(unrelated, exemplar);

    // Assert
    expect(result.possiblyPlagiarized).toBe(false);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1 for identical token sets", () => {
    // Setup
    const tokens = tokenizeForJaccard("alpha beta gamma");

    // Assert
    expect(jaccardSimilarity(tokens, tokens)).toBe(1);
  });
});
