import { describe, expect, it } from "vitest";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";

import {
  classifyBulletAgainstCorpus,
  dedupBullets,
  formatRecentBulletsAvoidanceBlock,
  scoreBulletSimilarity,
} from "./cross-run-dedup.js";

const minimalStructure = (
  patch: Partial<IndustryNewsletterStructure> = {},
): IndustryNewsletterStructure => ({
  subject: "Brief",
  industryPulse: { displayHeading: "Pulse", prose: "Lead." },
  competitiveLandscape: {
    displayHeading: "Competitive",
    bullets: [
      { text: "B1", articleIndex: 1 },
      { text: "B2", articleIndex: 2 },
    ],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ text: "D1", articleIndex: 3 }],
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
      { text: "h2", articleIndex: 2 },
      { text: "h3", articleIndex: 3 },
      { text: "h4", articleIndex: 1 },
      { text: "h5", articleIndex: 2 },
    ],
  },
  ...patch,
});

describe("scoreBulletSimilarity", () => {
  it("flags near-duplicate financial bullets above the default threshold", () => {
    // Setup
    const newBullet =
      "Policy rates held steady while lenders expanded mortgage books across major cities";
    const corpusText =
      "Policy rates held steady while lenders expanded mortgage books across major cities nationwide";

    // Act
    const similarity = scoreBulletSimilarity(newBullet, corpusText);
    const decision = classifyBulletAgainstCorpus(
      newBullet,
      [
        {
          newsletterId: "nl-1",
          sectionKey: "competitiveLandscape",
          bulletText: corpusText,
          createdAt: "2026-04-20T00:00:00.000Z",
        },
      ],
      0.55,
    );

    // Assert
    expect(similarity).toBeGreaterThanOrEqual(0.55);
    expect(decision.kind).toBe("near_duplicate");
  });

  it("passes unrelated bullets with low similarity", () => {
    // Setup
    const newBullet =
      "Policy rates held steady while lenders expanded mortgage books across major cities";
    const decision = classifyBulletAgainstCorpus(
      newBullet,
      [
        {
          newsletterId: "nl-2",
          sectionKey: "dealsAndMovements",
          bulletText: "Astra reports mining revenue growth in Kalimantan",
          createdAt: "2026-04-19T00:00:00.000Z",
        },
      ],
      0.55,
    );

    // Act
    const similarity = scoreBulletSimilarity(
      newBullet,
      "Astra reports mining revenue growth in Kalimantan",
    );

    // Assert
    expect(similarity).toBeLessThan(0.2);
    expect(decision.kind).toBe("unique");
  });
});

describe("dedupBullets — mark policy", () => {
  it("prepends [follow-up] to flagged bullets and keeps articleIndex", () => {
    // Setup
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          {
            text: "Policy rates held steady while lenders expanded mortgage books across major cities",
            articleIndex: 1,
          },
          { text: "Fresh angle on exports", articleIndex: 2 },
        ],
      },
    });
    const recent = [
      {
        newsletterId: "nl-old",
        sectionKey: "competitiveLandscape",
        bulletText:
          "Policy rates held steady while lenders expanded mortgage books across major cities nationwide",
        createdAt: "2026-04-18T00:00:00.000Z",
      },
    ];

    // Act
    const result = dedupBullets(structure, recent, {
      policy: "mark",
      minSimilarity: 0.55,
      lowInfoDayThreshold: 0.5,
    });

    // Assert
    expect(result.structure.competitiveLandscape.bullets[0]?.text).toBe(
      "[follow-up] Policy rates held steady while lenders expanded mortgage books across major cities",
    );
    expect(result.structure.competitiveLandscape.bullets[0]?.articleIndex).toBe(
      1,
    );
    expect(
      result.reports.some(
        (report) =>
          report.sectionKey === "competitiveLandscape" &&
          report.bulletIndex === 0 &&
          report.decision.kind === "near_duplicate",
      ),
    ).toBe(true);
  });
});

describe("dedupBullets — lowInformationDay", () => {
  it("sets lowInformationDay when a majority of bullets are near-duplicates", () => {
    // Setup
    const duplicateText =
      "BCA quarterly net profit growth remained strong across retail";
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { text: `BCA reported ${duplicateText}`, articleIndex: 1 },
          { text: `Again ${duplicateText}`, articleIndex: 1 },
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          { text: duplicateText, articleIndex: 2 },
          { text: `More on ${duplicateText}`, articleIndex: 2 },
        ],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [
          { text: duplicateText },
          { text: `Regulatory ${duplicateText}` },
        ],
      },
      quickHits: {
        displayHeading: "Quick",
        items: [
          { text: duplicateText, articleIndex: 1 },
          { text: duplicateText, articleIndex: 2 },
          { text: duplicateText, articleIndex: 3 },
          { text: "Unique mining headline", articleIndex: 1 },
          { text: "Another unique headline", articleIndex: 2 },
        ],
      },
    });
    const recent = [
      {
        newsletterId: "nl-1",
        sectionKey: "competitiveLandscape",
        bulletText: duplicateText,
        createdAt: "2026-04-17T00:00:00.000Z",
      },
    ];

    // Act
    const result = dedupBullets(structure, recent, {
      policy: "warn",
      minSimilarity: 0.55,
      lowInfoDayThreshold: 0.5,
    });

    // Assert
    expect(result.lowInformationDay).toBe(true);
    expect(result.nearDuplicates).toBeGreaterThanOrEqual(7);
  });

  it("clears lowInformationDay when fewer than half of bullets overlap", () => {
    // Setup
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          {
            text: "BCA quarterly net profit growth remained strong across retail",
            articleIndex: 1,
          },
          { text: "Unique export story", articleIndex: 2 },
        ],
      },
    });
    const recent = [
      {
        newsletterId: "nl-1",
        sectionKey: "competitiveLandscape",
        bulletText:
          "BCA quarterly net profit growth remained strong across retail",
        createdAt: "2026-04-17T00:00:00.000Z",
      },
    ];

    // Act
    const result = dedupBullets(structure, recent, {
      policy: "warn",
      minSimilarity: 0.55,
      lowInfoDayThreshold: 0.5,
    });

    // Assert
    expect(result.lowInformationDay).toBe(false);
  });
});

describe("formatRecentBulletsAvoidanceBlock", () => {
  it("includes exactly 15 bullet lines when more history is available", () => {
    // Setup
    const bullets = Array.from({ length: 30 }, (_, index) => ({
      newsletterId: `nl-${String(index)}`,
      sectionKey: "quickHits",
      bulletText: `Historical bullet ${String(index)}`,
      createdAt: new Date(2026, 3, 30 - index).toISOString(),
    }));

    // Act
    const block = formatRecentBulletsAvoidanceBlock(bullets, 14, 15);
    const lines = block.split("\n").filter((line) => line.startsWith("- "));

    // Assert
    expect(block).toContain("AVOID REPEATING THESE RECENT BULLETS");
    expect(lines).toHaveLength(15);
  });
});
