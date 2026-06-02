import { describe, expect, it } from "vitest";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";

import {
  enforceCompetitiveFocus,
  mentionsAny,
} from "./competitive-landscape-focus.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeStructure = (
  bullets: IndustryNewsletterStructure["competitiveLandscape"]["bullets"],
): IndustryNewsletterStructure => ({
  subject: "Test Subject",
  industryPulse: {
    displayHeading: "Industry Pulse",
    prose: "Sector overview.",
  },
  competitiveLandscape: {
    displayHeading: "Competitive Landscape",
    bullets,
  },
  dealsAndMovements: {
    displayHeading: "Deals",
    bullets: [{ text: "Deal A", articleIndex: 1 }],
  },
  regulatoryPolicyWatch: {
    displayHeading: "Regulatory",
    bullets: [{ text: "Rule B" }],
  },
  disruptorsOrTech: {
    format: "prose",
    displayHeading: "Disruptors",
    prose: "Tech moving fast.",
  },
  quickHits: {
    displayHeading: "Quick Hits",
    items: [
      { text: "h1", articleIndex: 1 },
      { text: "h2", articleIndex: 2 },
      { text: "h3", articleIndex: 3 },
      { text: "h4", articleIndex: 4 },
      { text: "h5", articleIndex: 5 },
    ],
  },
});

const ISSUER_ALIASES = ["Bank Central Asia", "BCA", "BBCA"];
const COMPETITORS = [
  { name: "Bank Mandiri", aliases: ["Mandiri"] },
  { name: "Bank BRI", aliases: ["BRI"] },
];

// ---------------------------------------------------------------------------
// mentionsAny
// ---------------------------------------------------------------------------

describe("mentionsAny — mention detection", () => {
  it("matches a full name case-insensitively", () => {
    expect(mentionsAny("BBCA expanded its digital channels", ["BBCA"])).toBe(
      true,
    );
  });

  it("does not match a substring inside a longer word", () => {
    expect(mentionsAny("BCAse study released today", ["BCA"])).toBe(false);
  });

  it("matches a multi-word name as a phrase", () => {
    expect(
      mentionsAny("Bank Mandiri undercut rivals on SME rates", [
        "Bank Mandiri",
      ]),
    ).toBe(true);
  });

  it("returns false when none of the names appear", () => {
    expect(
      mentionsAny("Sector-wide credit tightening continues", ["BBCA", "BCA"]),
    ).toBe(false);
  });

  it("matches at the start and end of the string (no adjacent chars)", () => {
    expect(mentionsAny("BBCA", ["BBCA"])).toBe(true);
    expect(mentionsAny("news about BBCA", ["BBCA"])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// enforceCompetitiveFocus — issuer-only drop
// ---------------------------------------------------------------------------

describe("enforceCompetitiveFocus — issuer-only drop", () => {
  it("drops an issuer-only bullet under drop policy", () => {
    const structure = makeStructure([
      { text: "BBCA expanded its digital channels", articleIndex: 1 },
      {
        text: "Bank Mandiri cut SME lending rates, pressuring BBCA",
        articleIndex: 2,
      },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "drop",
      requireCitationEnabled: true,
    });

    expect(result.summary.evaluated).toBe(1);
    expect(result.summary.dropped).toBe(1);
    expect(result.summary.flagged).toBe(0);
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(1);
    expect(result.structure.competitiveLandscape.bullets[0]!.text).toContain(
      "Bank Mandiri",
    );
  });

  it("keeps a bullet that mentions both issuer and competitor", () => {
    const structure = makeStructure([
      {
        text: "Bank Mandiri undercut BBCA on SME rates",
        articleIndex: 1,
      },
      {
        text: "BRI gained digital market share at BCA's expense",
        articleIndex: 2,
      },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "drop",
      requireCitationEnabled: true,
    });

    expect(result.summary.evaluated).toBe(0);
    expect(result.summary.dropped).toBe(0);
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(2);
  });

  it("keeps a generic bullet that mentions neither issuer nor competitor", () => {
    const structure = makeStructure([
      { text: "Sector-wide credit tightening continues", articleIndex: 1 },
      { text: "Regulatory reform may reshape lending", articleIndex: 2 },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "drop",
      requireCitationEnabled: true,
    });

    expect(result.summary.evaluated).toBe(0);
    expect(result.summary.dropped).toBe(0);
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(2);
  });

  it("flags an issuer-only bullet under flag policy (prepends marker)", () => {
    const structure = makeStructure([
      { text: "BBCA expanded its digital channels", articleIndex: 1 },
      { text: "Bank Mandiri launched a new SME product", articleIndex: 2 },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "flag",
    });

    expect(result.summary.flagged).toBe(1);
    expect(result.summary.dropped).toBe(0);
    const flaggedBullet = result.structure.competitiveLandscape.bullets.find(
      (bullet) => bullet.text.startsWith("[ISSUER-ONLY]"),
    );
    expect(flaggedBullet).toBeDefined();
  });

  it("does not drop bullets under warn policy", () => {
    const structure = makeStructure([
      { text: "BBCA expanded its digital channels", articleIndex: 1 },
      { text: "BCA internal strategy unchanged", articleIndex: 2 },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "warn",
    });

    expect(result.summary.dropped).toBe(0);
    expect(result.summary.flagged).toBe(0);
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// enforceCompetitiveFocus — empty competitors no-op
// ---------------------------------------------------------------------------

describe("enforceCompetitiveFocus — empty competitors is a no-op", () => {
  it("returns unchanged structure with evaluated=0 when competitors is empty", () => {
    const structure = makeStructure([
      { text: "BBCA expanded its digital channels", articleIndex: 1 },
      { text: "BCA raised its dividend yield", articleIndex: 2 },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: [],
      issuerAliases: ISSUER_ALIASES,
      policy: "drop",
    });

    expect(result.summary.evaluated).toBe(0);
    expect(result.summary.dropped).toBe(0);
    expect(result.summary.flagged).toBe(0);
    expect(result.summary.competitorCount).toBe(0);
    expect(result.structure).toBe(structure);
  });
});

// ---------------------------------------------------------------------------
// enforceCompetitiveFocus — floor vs prune handoff
// ---------------------------------------------------------------------------

describe("enforceCompetitiveFocus — floor vs prune handoff", () => {
  it("downgrades drops to flags when require-citation is OFF and all bullets are issuer-only", () => {
    const structure = makeStructure([
      { text: "BBCA launched a new savings product", articleIndex: 1 },
      { text: "Bank Central Asia expanded branch network", articleIndex: 2 },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "drop",
      requireCitationEnabled: false,
    });

    expect(result.summary.dropped).toBe(0);
    expect(result.summary.flagged).toBe(2);
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(2);
    expect(
      result.structure.competitiveLandscape.bullets.every((bullet) =>
        bullet.text.startsWith("[ISSUER-ONLY]"),
      ),
    ).toBe(true);
  });

  it("drops one bullet and flags the rest when require-citation is OFF and 3 of 3 are issuer-only", () => {
    const structure = makeStructure([
      { text: "BBCA opened new branches", articleIndex: 1 },
      { text: "BCA upgraded its mobile app", articleIndex: 2 },
      { text: "Bank Central Asia raised its dividend", articleIndex: 3 },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "drop",
      requireCitationEnabled: false,
    });

    // 3 bullets, floor is 2 → can drop at most 1, flag the remaining 2 issuer-only
    expect(result.summary.dropped).toBe(1);
    expect(result.summary.flagged).toBe(2);
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(2);
  });

  it("drops all issuer-only bullets when require-citation is ON, allowing the section to empty", () => {
    const structure = makeStructure([
      { text: "BBCA launched a new savings product", articleIndex: 1 },
      { text: "Bank Central Asia expanded branch network", articleIndex: 2 },
    ]);

    const result = enforceCompetitiveFocus(structure, {
      competitors: COMPETITORS,
      issuerAliases: ISSUER_ALIASES,
      policy: "drop",
      requireCitationEnabled: true,
    });

    expect(result.summary.dropped).toBe(2);
    expect(result.summary.flagged).toBe(0);
    expect(result.structure.competitiveLandscape.bullets).toHaveLength(0);
  });
});
