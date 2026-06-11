import { describe, expect, it } from "vitest";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";

import { polishNewsletter } from "./newsletter-polish.js";

const minimalStructure = (
  patch: Partial<IndustryNewsletterStructure> = {},
): IndustryNewsletterStructure => ({
  subject: "Brief",
  industryPulse: { displayHeading: "Pulse", prose: "Lead." },
  competitiveLandscape: {
    displayHeading: "Competitive",
    bullets: [
      { title: "T1", text: "B1", articleIndex: 1 },
      { title: "T2", text: "B2", articleIndex: 2 },
    ],
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ title: "T3", text: "D1", articleIndex: 3 }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Regulatory",
    bullets: [{ title: "T4", text: "R1" }],
  },
  disruptorsOrTech: {
    format: "prose",
    displayHeading: "Disruptors",
    prose: "Tech note.",
  },
  quickHits: {
    displayHeading: "Quick",
    items: [
      { title: "Q1", text: "h1", articleIndex: 1 },
      { title: "Q2", text: "h2", articleIndex: 2 },
      { title: "Q3", text: "h3", articleIndex: 3 },
      { title: "Q4", text: "h4", articleIndex: 1 },
      { title: "Q5", text: "h5", articleIndex: 2 },
    ],
  },
  ...patch,
});

describe("polishNewsletter filler removal", () => {
  it("preserves capitalization after It's worth noting that removal", () => {
    // Setup
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          {
            title: "T1",
            text: "It's worth noting that BCA grew profit by 12%",
            articleIndex: 1,
          },
          { title: "T2", text: "B2", articleIndex: 2 },
        ],
      },
    });

    // Act
    const result = polishNewsletter(structure, {
      tier: "safe",
      disabledRuleIds: [],
    });

    // Assert
    expect(result.structure.competitiveLandscape.bullets[0]?.text).toBe(
      "BCA grew profit by 12%",
    );
    expect(result.rulesFired["filler-its-worth-noting"]).toBe(1);
  });

  it("preserves capitalization after Importantly removal", () => {
    // Setup
    const structure = minimalStructure({
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [
          {
            title: "T1",
            text: "Importantly, the regulator approved the merger",
          },
        ],
      },
    });

    // Act
    const result = polishNewsletter(structure, {
      tier: "safe",
      disabledRuleIds: [],
    });

    // Assert
    expect(result.structure.regulatoryPolicyWatch.bullets[0]?.text).toBe(
      "The regulator approved the merger",
    );
    expect(result.rulesFired["filler-importantly"]).toBe(1);
  });
});

describe("polishNewsletter hedge collapse", () => {
  it("collapses could potentially and may possibly stacks", () => {
    // Setup
    const structure = minimalStructure({
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          {
            title: "T1",
            text: "The deal could potentially close in Q3",
            articleIndex: 1,
          },
        ],
      },
      quickHits: {
        displayHeading: "Quick",
        items: [
          {
            title: "Q1",
            text: "Earnings may possibly disappoint",
            articleIndex: 1,
          },
          { title: "Q2", text: "h2", articleIndex: 2 },
          { title: "Q3", text: "h3", articleIndex: 3 },
          { title: "Q4", text: "h4", articleIndex: 1 },
          { title: "Q5", text: "h5", articleIndex: 2 },
        ],
      },
    });

    // Act
    const result = polishNewsletter(structure, {
      tier: "safe",
      disabledRuleIds: [],
    });

    // Assert
    expect(result.structure.dealsAndMovements.bullets[0]?.text).toBe(
      "The deal could close in Q3",
    );
    expect(result.structure.quickHits.items[0]?.text).toBe(
      "Earnings may disappoint",
    );
    expect(result.rulesFired["hedge-could-potentially"]).toBe(1);
    expect(result.rulesFired["hedge-may-possibly"]).toBe(1);
  });
});

describe("polishNewsletter overused words", () => {
  it("replaces robust in exactly one bullet when tier is aggressive and 4 bullets repeat it", () => {
    // Setup
    const robustBullets = [
      { title: "T1", text: "First robust growth outlook", articleIndex: 1 },
      { title: "T2", text: "Second robust growth outlook", articleIndex: 2 },
      { title: "T3", text: "Third robust growth outlook", articleIndex: 3 },
      { title: "T4", text: "Fourth robust growth outlook", articleIndex: 1 },
    ];
    const structure = minimalStructure({
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: robustBullets.slice(0, 2),
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [robustBullets[2]!],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [robustBullets[3]!],
      },
    });

    // Act
    const result = polishNewsletter(structure, {
      tier: "aggressive",
      disabledRuleIds: [],
    });

    // Assert
    const allBulletTexts = [
      ...result.structure.competitiveLandscape.bullets.map((b) => b.text),
      ...result.structure.dealsAndMovements.bullets.map((b) => b.text),
      ...result.structure.regulatoryPolicyWatch.bullets.map((b) => b.text),
    ];
    const strongCount = allBulletTexts.filter((text) =>
      /\bstrong\b/i.test(text),
    ).length;
    const robustCount = allBulletTexts.filter((text) =>
      /\brobust\b/i.test(text),
    ).length;
    expect(strongCount).toBe(1);
    expect(robustCount).toBe(3);
    expect(result.rulesFired["overused-robust"]).toBe(1);
  });
});

describe("polishNewsletter disabled rules", () => {
  it("skips disabled filler rules while other rules still fire", () => {
    // Setup
    const structure = minimalStructure({
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          {
            title: "T1",
            text: "It's worth noting that BCA grew profit by 12%",
            articleIndex: 1,
          },
        ],
      },
      quickHits: {
        displayHeading: "Quick",
        items: [
          {
            title: "Q1",
            text: "Earnings may possibly disappoint",
            articleIndex: 1,
          },
          { title: "Q2", text: "h2", articleIndex: 2 },
          { title: "Q3", text: "h3", articleIndex: 3 },
          { title: "Q4", text: "h4", articleIndex: 1 },
          { title: "Q5", text: "h5", articleIndex: 2 },
        ],
      },
    });

    // Act
    const result = polishNewsletter(structure, {
      tier: "safe",
      disabledRuleIds: ["filler-its-worth-noting"],
    });

    // Assert
    expect(result.structure.dealsAndMovements.bullets[0]?.text).toBe(
      "It's worth noting that BCA grew profit by 12%",
    );
    expect(result.structure.quickHits.items[0]?.text).toBe(
      "Earnings may disappoint",
    );
    expect(result.rulesFired["filler-its-worth-noting"]).toBeUndefined();
    expect(result.rulesFired["hedge-may-possibly"]).toBe(1);
  });
});
