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
    expect(keys).toEqual([
      "industry-pulse",
      "deals-and-movements",
      "quick-hits",
    ]);
  });

  it("peels a trailing Read the full article line from the industry-pulse prose into url", () => {
    const wire = [
      INDUSTRY_NEWSLETTER_WIRE_MARKER,
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "The Pulse",
      "PROSE",
      "Grounded summary of the week.",
      "Read the full article: https://grounded.example/article",
      "END",
      "",
    ].join("\n");

    const parsed = parseIndustryNewsletterWire(wire);

    expect(parsed).not.toBeUndefined();
    const pulseSection = parsed?.sections.find(
      (s) => s.machineKey === "industry-pulse",
    );
    expect(pulseSection).toBeDefined();
    if (pulseSection?.machineKey === "industry-pulse") {
      expect(pulseSection.prose).toBe("Grounded summary of the week.");
      expect(pulseSection.url).toBe("https://grounded.example/article");
    }
  });

  it("leaves url undefined when industry-pulse prose has no trailing source line", () => {
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

    const pulseSection = parsed?.sections.find(
      (s) => s.machineKey === "industry-pulse",
    );
    if (pulseSection?.machineKey === "industry-pulse") {
      expect(pulseSection.url).toBeUndefined();
    }
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

  it("parses TITLE lines on bullets and items into the title field", () => {
    const wire = [
      INDUSTRY_NEWSLETTER_WIRE_MARKER,
      "",
      "BEGIN competitive-landscape",
      "DISPLAY_HEADING",
      "Competition",
      "BULLET",
      "TITLE Rival A Launches",
      "Rival A launched a competing product.",
      "BULLET",
      "No title bullet.",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Quick Hits",
      "ITEM",
      "TITLE Hit One",
      "First quick hit.",
      "ITEM",
      "Second hit with no title.",
      "END",
      "",
    ].join("\n");

    const parsed = parseIndustryNewsletterWire(wire);

    expect(parsed).not.toBeUndefined();
    const landscape = parsed?.sections.find(
      (s) => s.machineKey === "competitive-landscape",
    );
    const quickHits = parsed?.sections.find(
      (s) => s.machineKey === "quick-hits",
    );

    expect(landscape?.machineKey).toBe("competitive-landscape");
    if (landscape?.machineKey === "competitive-landscape") {
      expect(landscape.bullets[0]?.title).toBe("Rival A Launches");
      expect(landscape.bullets[1]?.title).toBeUndefined();
    }

    expect(quickHits?.machineKey).toBe("quick-hits");
    if (quickHits?.machineKey === "quick-hits") {
      expect(quickHits.items[0]?.title).toBe("Hit One");
      expect(quickHits.items[1]?.title).toBeUndefined();
    }
  });

  it("parses AUTHOR and SOURCE byline lines on the lead, bullets, and items", () => {
    const wire = [
      INDUSTRY_NEWSLETTER_WIRE_MARKER,
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "The Pulse",
      "AUTHOR Lead Writer",
      "SOURCE Readers.id",
      "PROSE",
      "Lead prose.",
      "END",
      "",
      "BEGIN competitive-landscape",
      "DISPLAY_HEADING",
      "Competition",
      "BULLET",
      "TITLE Rival A Launches",
      "AUTHOR Jane Reporter",
      "SOURCE The Star",
      "Rival A launched a competing product.",
      "BULLET",
      "Bullet with no byline.",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Quick Hits",
      "ITEM",
      "SOURCE Kontan",
      "First quick hit.",
      "END",
      "",
    ].join("\n");

    const parsed = parseIndustryNewsletterWire(wire);

    const pulse = parsed?.sections.find(
      (s) => s.machineKey === "industry-pulse",
    );
    if (pulse?.machineKey === "industry-pulse") {
      expect(pulse.author).toBe("Lead Writer");
      expect(pulse.source).toBe("Readers.id");
      expect(pulse.prose).toBe("Lead prose.");
    }

    const landscape = parsed?.sections.find(
      (s) => s.machineKey === "competitive-landscape",
    );
    if (landscape?.machineKey === "competitive-landscape") {
      expect(landscape.bullets[0]?.author).toBe("Jane Reporter");
      expect(landscape.bullets[0]?.source).toBe("The Star");
      expect(landscape.bullets[0]?.text).toBe(
        "Rival A launched a competing product.",
      );
      expect(landscape.bullets[1]?.author).toBeUndefined();
      expect(landscape.bullets[1]?.source).toBeUndefined();
    }

    const quickHits = parsed?.sections.find(
      (s) => s.machineKey === "quick-hits",
    );
    if (quickHits?.machineKey === "quick-hits") {
      expect(quickHits.items[0]?.author).toBeUndefined();
      expect(quickHits.items[0]?.source).toBe("Kontan");
      expect(quickHits.items[0]?.text).toBe("First quick hit.");
    }
  });
});
