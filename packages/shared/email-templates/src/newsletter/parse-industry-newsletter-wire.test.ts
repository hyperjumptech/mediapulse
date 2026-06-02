import { describe, expect, it } from "vitest";

import {
  parseIndustryNewsletterWire,
  INDUSTRY_NEWSLETTER_WIRE_MARKER,
} from "./parse-industry-newsletter-wire.js";

describe("parseIndustryNewsletterWire", () => {
  it("returns undefined when the marker is missing", () => {
    expect(parseIndustryNewsletterWire("not a newsletter")).toBeUndefined();
    expect(parseIndustryNewsletterWire("")).toBeUndefined();
  });

  it("parses a wire containing only industry-pulse", () => {
    const wire = [
      INDUSTRY_NEWSLETTER_WIRE_MARKER,
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "The Pulse",
      "PROSE",
      "Sector tone stayed stable this week.",
      "END",
      "",
    ].join("\n");

    const parsed = parseIndustryNewsletterWire(wire);

    expect(parsed).not.toBeUndefined();
    expect(parsed?.format).toBe("industry");
    expect(parsed?.sections).toHaveLength(1);
    expect(parsed?.sections[0]?.machineKey).toBe("industry-pulse");
  });

  it("accepts any in-order subset of body sections", () => {
    const wire = [
      INDUSTRY_NEWSLETTER_WIRE_MARKER,
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "Pulse",
      "PROSE",
      "Pulse prose.",
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
      "Hit one.",
      "ITEM",
      "Hit two.",
      "END",
      "",
    ].join("\n");

    const parsed = parseIndustryNewsletterWire(wire);

    expect(parsed?.format).toBe("industry");
    const keys = parsed?.sections.map((s) => s.machineKey);
    expect(keys).toEqual(["industry-pulse", "deals-and-movements", "quick-hits"]);
  });

  it("skipped middle section does not shift the survivors out of order", () => {
    const wire = [
      INDUSTRY_NEWSLETTER_WIRE_MARKER,
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "Pulse",
      "PROSE",
      "Lead.",
      "END",
      "",
      "BEGIN regulatory-policy-watch",
      "DISPLAY_HEADING",
      "Policy",
      "BULLET",
      "A regulation passed.",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Quick Hits",
      "ITEM",
      "One.",
      "END",
      "",
    ].join("\n");

    const parsed = parseIndustryNewsletterWire(wire);

    const keys = parsed?.sections.map((s) => s.machineKey);
    expect(keys).toEqual([
      "industry-pulse",
      "regulatory-policy-watch",
      "quick-hits",
    ]);
  });
});
