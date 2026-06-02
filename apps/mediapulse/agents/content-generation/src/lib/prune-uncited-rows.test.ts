import { describe, expect, it } from "vitest";

import type { IndustryNewsletterResolved } from "../industry-newsletter-urls.js";
import { pruneNewsletterToCitedRows } from "./prune-uncited-rows.js";

const CITED_URL_A = "https://source.example/a";
const CITED_URL_B = "https://source.example/b";
const CITED_URL_C = "https://source.example/c";

const basePulse: IndustryNewsletterResolved["industryPulse"] = {
  displayHeading: "Pulse",
  prose: "Lead prose.",
};

describe("pruneNewsletterToCitedRows — uncited rows dropped", () => {
  it("keeps cited bullets and drops uncited ones; counts removedBullets correctly", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [
          { text: "Cited A", url: CITED_URL_A },
          { text: "No citation" },
          { text: "Cited B", url: CITED_URL_B },
        ],
      },
    };

    const {
      resolved: pruned,
      reports,
      summary,
    } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.competitiveLandscape?.bullets).toHaveLength(2);
    expect(pruned.competitiveLandscape?.bullets[0]?.text).toBe("Cited A");
    expect(pruned.competitiveLandscape?.bullets[1]?.text).toBe("Cited B");

    const report = reports.find((r) => r.sectionKey === "competitiveLandscape");
    expect(report?.removedBullets).toBe(1);
    expect(report?.sectionRemoved).toBe(false);

    expect(summary.bulletsRemovedUncited).toBe(1);
    expect(summary.bulletsRemovedDuplicate).toBe(0);
    expect(summary.sectionsKept).toBe(1);
    expect(summary.sectionsRemoved).toBe(0);
  });

  it("treats a bullet with url undefined as uncited (out-of-range articleIndex resolves to undefined)", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          { text: "Good deal", url: CITED_URL_A },
          { text: "Bad index" },
        ],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.dealsAndMovements?.bullets).toHaveLength(1);
    expect(summary.bulletsRemovedUncited).toBe(1);
  });

  it("quick-hits without url are dropped; items with url are kept", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      quickHits: {
        displayHeading: "Quick Hits",
        items: [
          { text: "Cited", url: CITED_URL_A },
          { text: "Uncited" },
          { text: "Cited too", url: CITED_URL_B },
        ],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.quickHits?.items).toHaveLength(2);
    expect(summary.bulletsRemovedUncited).toBe(1);
  });
});

describe("pruneNewsletterToCitedRows — duplicate article dedup", () => {
  it("keeps first bullet per URL within a section, drops later duplicates", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [
          { text: "First cite A", url: CITED_URL_A },
          { text: "Second cite A", url: CITED_URL_A },
          { text: "First cite B", url: CITED_URL_B },
        ],
      },
    };

    const {
      resolved: pruned,
      reports,
      summary,
    } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.competitiveLandscape?.bullets).toHaveLength(2);
    expect(pruned.competitiveLandscape?.bullets[0]?.text).toBe("First cite A");
    expect(pruned.competitiveLandscape?.bullets[1]?.text).toBe("First cite B");

    const report = reports.find((r) => r.sectionKey === "competitiveLandscape");
    expect(report?.removedForDuplicate).toBe(1);
    expect(summary.bulletsRemovedDuplicate).toBe(1);
    expect(summary.bulletsRemovedUncited).toBe(0);
  });

  it("dedupeScope 'section' isolates dedup per section — same URL allowed in different sections", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [{ text: "CL bullet", url: CITED_URL_A }],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ text: "Deals bullet", url: CITED_URL_A }],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved, {
      dedupeScope: "section",
    });

    expect(pruned.competitiveLandscape?.bullets).toHaveLength(1);
    expect(pruned.dealsAndMovements?.bullets).toHaveLength(1);
    expect(summary.bulletsRemovedDuplicate).toBe(0);
  });

  it("dedupeScope 'newsletter' drops second section bullet reusing an article from a prior section", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [{ text: "CL bullet", url: CITED_URL_A }],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          { text: "Deals bullet citing same article", url: CITED_URL_A },
          { text: "Deals bullet citing new article", url: CITED_URL_B },
        ],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved, {
      dedupeScope: "newsletter",
    });

    expect(pruned.competitiveLandscape?.bullets).toHaveLength(1);
    expect(pruned.dealsAndMovements?.bullets).toHaveLength(1);
    expect(pruned.dealsAndMovements?.bullets[0]?.text).toBe(
      "Deals bullet citing new article",
    );
    expect(summary.bulletsRemovedDuplicate).toBe(1);
  });

  it("dedupeArticlesWithinSection false disables dedup entirely", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [
          { text: "First", url: CITED_URL_A },
          { text: "Duplicate", url: CITED_URL_A },
        ],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved, {
      dedupeArticlesWithinSection: false,
    });

    expect(pruned.competitiveLandscape?.bullets).toHaveLength(2);
    expect(summary.bulletsRemovedDuplicate).toBe(0);
  });
});

describe("pruneNewsletterToCitedRows — section removal", () => {
  it("removes a section when all its bullets are uncited", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      regulatoryPolicyWatch: {
        displayHeading: "Policy",
        bullets: [{ text: "Uncited bullet" }],
      },
    };

    const {
      resolved: pruned,
      reports,
      summary,
    } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.regulatoryPolicyWatch).toBeUndefined();

    const report = reports.find(
      (r) => r.sectionKey === "regulatoryPolicyWatch",
    );
    expect(report?.sectionRemoved).toBe(true);
    expect(report?.removedBullets).toBe(1);

    expect(summary.sectionsRemoved).toBe(1);
    expect(summary.sectionsKept).toBe(0);
  });

  it("keeps a section with exactly one cited bullet (the min-one floor)", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ text: "One good deal", url: CITED_URL_A }],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.dealsAndMovements?.bullets).toHaveLength(1);
    expect(summary.sectionsRemoved).toBe(0);
    expect(summary.sectionsKept).toBe(1);
  });

  it("removes disruptorsOrTech bullets variant when all bullets are uncited", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      disruptorsOrTech: {
        format: "bullets",
        displayHeading: "Tech",
        bullets: [{ text: "Uncited tech" }],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.disruptorsOrTech).toBeUndefined();
    expect(summary.sectionsRemoved).toBe(1);
  });

  it("never prunes disruptorsOrTech prose variant", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      disruptorsOrTech: {
        format: "prose",
        displayHeading: "Tech",
        prose: "Innovation is happening.",
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.disruptorsOrTech).toBeDefined();
    expect((pruned.disruptorsOrTech as { format: string }).format).toBe(
      "prose",
    );
    expect(summary.sectionsKept).toBe(1);
    expect(summary.sectionsRemoved).toBe(0);
  });

  it("never prunes industry-pulse regardless of configuration", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: { displayHeading: "Lead", prose: "Sector summary." },
    };

    const { resolved: pruned } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.industryPulse.prose).toBe("Sector summary.");
  });

  it("skips sections not in the configured sections list", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [{ text: "Uncited" }],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ text: "Uncited" }],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved, {
      sections: ["dealsAndMovements"],
    });

    // competitiveLandscape was not in scope — passes through unchanged
    expect(pruned.competitiveLandscape?.bullets).toHaveLength(1);
    // dealsAndMovements was in scope and had no cited rows — removed
    expect(pruned.dealsAndMovements).toBeUndefined();
    expect(summary.sectionsRemoved).toBe(1);
  });

  it("removes quickHits section when all items are uncited", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      quickHits: {
        displayHeading: "Quick Hits",
        items: [{ text: "No url" }, { text: "Also no url" }],
      },
    };

    const { resolved: pruned, summary } = pruneNewsletterToCitedRows(resolved);

    expect(pruned.quickHits).toBeUndefined();
    expect(summary.sectionsRemoved).toBe(1);
  });

  it("produces correct aggregate summary across multiple sections", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [{ text: "Cited", url: CITED_URL_A }, { text: "Uncited" }],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ text: "Uncited only" }],
      },
      quickHits: {
        displayHeading: "Quick Hits",
        items: [
          { text: "Cited A", url: CITED_URL_A },
          { text: "Cited A dup", url: CITED_URL_A },
          { text: "Cited B", url: CITED_URL_B },
        ],
      },
    };

    const { summary } = pruneNewsletterToCitedRows(resolved);

    expect(summary.bulletsRemovedUncited).toBe(2);
    expect(summary.bulletsRemovedDuplicate).toBe(1);
    expect(summary.sectionsRemoved).toBe(1);
    expect(summary.sectionsKept).toBe(2);
  });
});
