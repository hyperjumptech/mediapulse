import { describe, expect, it } from "vitest";

import { flattenBulletsFromNewsletterWire } from "./flatten-newsletter-wire-bullets.js";

const MARKER = "MP_NEWSLETTER";

const buildWire = (sections: string[]): string =>
  [MARKER, "", ...sections].join("\n").trimEnd() + "\n";

describe("flattenBulletsFromNewsletterWire", () => {
  it("returns empty array for non-wire content", () => {
    const result = flattenBulletsFromNewsletterWire("id1", "not a wire", "2024-01-01T00:00:00Z");
    expect(result).toEqual([]);
  });

  it("flattens all sections from a full wire", () => {
    const wire = buildWire([
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "Pulse",
      "PROSE",
      "Lead.",
      "END",
      "",
      "BEGIN competitive-landscape",
      "DISPLAY_HEADING",
      "Competition",
      "BULLET",
      "Rival A underbid.",
      "BULLET",
      "Fleet oversupply.",
      "END",
      "",
      "BEGIN deals-and-movements",
      "DISPLAY_HEADING",
      "Deals",
      "BULLET",
      "A deal closed.",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Quick Hits",
      "ITEM",
      "One.",
      "ITEM",
      "Two.",
      "END",
      "",
    ]);

    const result = flattenBulletsFromNewsletterWire("id1", wire, "2024-01-01T00:00:00Z");

    const sectionKeys = result.map((r) => r.sectionKey);
    expect(sectionKeys).toContain("competitiveLandscape");
    expect(sectionKeys).toContain("dealsAndMovements");
    expect(sectionKeys).toContain("quickHits");
    expect(result.filter((r) => r.sectionKey === "competitiveLandscape")).toHaveLength(2);
  });

  it("flattens without throwing when competitive-landscape is absent", () => {
    const wire = buildWire([
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "Pulse",
      "PROSE",
      "Lead.",
      "END",
      "",
      "BEGIN deals-and-movements",
      "DISPLAY_HEADING",
      "Deals",
      "BULLET",
      "A deal closed.",
      "BULLET",
      "Another deal.",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Quick Hits",
      "ITEM",
      "Hit one.",
      "ITEM",
      "Hit two.",
      "END",
      "",
    ]);

    const result = flattenBulletsFromNewsletterWire("id2", wire, "2024-01-01T00:00:00Z");

    expect(result.some((r) => r.sectionKey === "competitiveLandscape")).toBe(false);
    expect(result.filter((r) => r.sectionKey === "dealsAndMovements")).toHaveLength(2);
    expect(result.filter((r) => r.sectionKey === "quickHits")).toHaveLength(2);
    expect(result.every((r) => r.newsletterId === "id2")).toBe(true);
  });
});
