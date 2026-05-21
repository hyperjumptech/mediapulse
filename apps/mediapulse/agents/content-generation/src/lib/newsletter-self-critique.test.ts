import { describe, expect, it } from "vitest";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
import {
  applyNewsletterCritiqueResults,
  countNewsletterCritiqueBullets,
  type NewsletterCritiqueRating,
} from "./newsletter-self-critique.js";

const tenBulletStructure = (): IndustryNewsletterStructure => ({
  subject: "Weekly briefing",
  industryPulse: { displayHeading: "Pulse", prose: "Markets moved." },
  competitiveLandscape: {
    displayHeading: "Competitive",
    bullets: [
      { text: "Weak bullet one.", articleIndex: 1 },
      { text: "Weak bullet two.", articleIndex: 1 },
      { text: "Weak bullet three.", articleIndex: 1 },
    ],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ text: "Deal bullet.", articleIndex: 1 }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Policy",
    bullets: [{ text: "Policy bullet.", articleIndex: 1 }],
  },
  disruptorsOrTech: {
    format: "prose",
    displayHeading: "Tech",
    prose: "Automation continued.",
  },
  quickHits: {
    displayHeading: "Hits",
    items: [
      { text: "Hit 1", articleIndex: 1 },
      { text: "Hit 2", articleIndex: 1 },
      { text: "Hit 3", articleIndex: 1 },
      { text: "Hit 4", articleIndex: 1 },
      { text: "Hit 5", articleIndex: 1 },
    ],
  },
});

const rating = (
  sectionKey: string,
  bulletIndex: number,
  patch: Partial<NewsletterCritiqueRating> = {},
): NewsletterCritiqueRating => ({
  sectionKey,
  bulletIndex,
  specificity: 1,
  citationStrength: 1,
  redundancy: 5,
  readerValue: 1,
  drop: true,
  rationale: "Too vague.",
  ...patch,
});

describe("applyNewsletterCritiqueResults", () => {
  it("rewrites up to dropFraction rows when suggestedRewrite is present", () => {
    // Setup
    const structure = tenBulletStructure();
    const ratings: NewsletterCritiqueRating[] = [
      rating("competitiveLandscape", 0, {
        suggestedRewrite: "Concrete rewrite one with 12.4 trillion profit.",
      }),
      rating("competitiveLandscape", 1, {
        suggestedRewrite: "Concrete rewrite two with margin expansion.",
      }),
      rating("competitiveLandscape", 2, {
        suggestedRewrite: "Concrete rewrite three with deal size.",
      }),
    ];

    // Act
    const result = applyNewsletterCritiqueResults(structure, ratings, {
      dropFraction: 0.2,
      preferRewriteOverDrop: true,
    });

    // Assert
    expect(countNewsletterCritiqueBullets(result.structure)).toBe(10);
    expect(result.summary.bulletsRewritten).toBe(2);
    expect(result.summary.bulletsDropped).toBe(0);
    expect(result.structure.competitiveLandscape.bullets[0]?.text).toContain(
      "Concrete rewrite one",
    );
  });

  it("preserves competitiveLandscape floor when a drop would violate min(2)", () => {
    // Setup
    const structure: IndustryNewsletterStructure = {
      ...tenBulletStructure(),
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          { text: "Weak one.", articleIndex: 1 },
          { text: "Weak two.", articleIndex: 1 },
        ],
      },
    };
    const ratings: NewsletterCritiqueRating[] = [
      rating("competitiveLandscape", 0),
      rating("competitiveLandscape", 1),
    ];

    // Act
    const result = applyNewsletterCritiqueResults(structure, ratings, {
      dropFraction: 0.2,
      preferRewriteOverDrop: false,
    });

    // Assert
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(2);
    expect(result.summary.floorPreserved).toBe(1);
    expect(result.summary.bulletsDropped).toBe(0);
  });
});

describe("countNewsletterCritiqueBullets", () => {
  it("counts bullets across critique-eligible sections", () => {
    // Assert
    expect(countNewsletterCritiqueBullets(tenBulletStructure())).toBe(10);
  });
});
