import { describe, expect, it } from "vitest";

import {
  parseNewsletterBody,
  type LegacyParsedNewsletterBody,
} from "./parse-newsletter-body.js";

/**
 * Parses a body that must use the legacy executive summary + top news wire shape.
 *
 * @param bodyText - Legacy wire body.
 * @returns Legacy parse result.
 */
const expectLegacyBody = (bodyText: string): LegacyParsedNewsletterBody => {
  const result = parseNewsletterBody(bodyText);
  expect(result).toBeDefined();
  expect(result!.format).toBe("legacy");
  return result as LegacyParsedNewsletterBody;
};

describe("parseNewsletterBody", () => {
  it("parses a well-formed body with 3 news items", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today as tech earnings exceeded expectations.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. Fed holds rates steady",
      "The Federal Reserve announced no change to interest rates.",
      "",
      "2. Apple beats estimates",
      "Apple reported record quarterly revenue of $95B.",
      "",
      "3. Oil prices dip",
      "Crude oil fell 2% amid easing geopolitical tensions.",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.executiveSummary).toBe(
      "Markets rallied today as tech earnings exceeded expectations.",
    );
    expect(result!.topNewsItems).toHaveLength(3);
    expect(result!.topNewsItems[0]).toEqual({
      number: 1,
      title: "Fed holds rates steady",
      summary: "The Federal Reserve announced no change to interest rates.",
    });
    expect(result!.topNewsItems[2]).toEqual({
      number: 3,
      title: "Oil prices dip",
      summary: "Crude oil fell 2% amid easing geopolitical tensions.",
    });
  });

  it("extracts the source url even when the read label was translated", () => {
    // Setup: translation localizes "Read the full article"; the URL must still peel off the summary.
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Ringkasan pasar hari ini.",
      "",
      "---",
      "",
      "TOP 1 NEWS",
      "",
      "1. Fed holds rates steady",
      "Bank sentral mempertahankan suku bunga.",
      "Baca artikel lengkapnya: https://example.com/fed",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result!.topNewsItems[0]).toEqual({
      number: 1,
      title: "Fed holds rates steady",
      summary: "Bank sentral mempertahankan suku bunga.",
      url: "https://example.com/fed",
    });
  });

  it("parses a well-formed body with 5 news items (different N)", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "A busy day in markets.",
      "",
      "---",
      "",
      "TOP 5 NEWS",
      "",
      "1. Item one",
      "Summary one.",
      "",
      "2. Item two",
      "Summary two.",
      "",
      "3. Item three",
      "Summary three.",
      "",
      "4. Item four",
      "Summary four.",
      "",
      "5. Item five",
      "Summary five.",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.topNewsItems).toHaveLength(5);

    const first = result!.topNewsItems[0];
    expect(first).toBeDefined();
    expect(first!.number).toBe(1);

    const fifth = result!.topNewsItems[4];
    expect(fifth).toBeDefined();
    expect(fifth!.number).toBe(5);
  });

  it("returns undefined when EXECUTIVE SUMMARY marker is missing", () => {
    // Setup
    const bodyText = [
      "Some other header",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. Item one",
      "Summary one.",
    ].join("\n");

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined when --- separator is missing", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "TOP 3 NEWS",
      "",
      "1. Item one",
      "Summary one.",
    ].join("\n");

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined when TOP N NEWS marker is missing", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "Some other section",
      "",
      "1. Item one",
      "Summary one.",
    ].join("\n");

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined when news items do not match expected pattern", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "No numbered items here.",
      "Just free-form text.",
    ].join("\n");

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("handles leading and trailing whitespace on the body text", () => {
    // Setup
    const bodyText = [
      "  EXECUTIVE SUMMARY",
      "",
      "  Markets rallied today.  ",
      "",
      "---",
      "",
      "TOP 3 NEWS  ",
      "",
      "1. Item one  ",
      "Summary one.",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.executiveSummary).toBe("Markets rallied today.");
    expect(result!.topNewsItems).toHaveLength(1);

    const first = result!.topNewsItems[0];
    expect(first).toBeDefined();
    expect(first!.title).toBe("Item one");
  });

  it("handles case-insensitive section headers", () => {
    // Setup
    const bodyText = [
      "Executive Summary",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "top 3 news",
      "",
      "1. Item one",
      "Summary one.",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.executiveSummary).toBe("Markets rallied today.");
    expect(result!.topNewsItems).toHaveLength(1);
  });

  it("returns undefined for an empty string", () => {
    // Setup
    const bodyText = "";

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined when executive summary text is empty after the marker", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. Item one",
      "Summary one.",
    ].join("\n");

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined when news items block is empty after the marker", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
    ].join("\n");

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("extracts a trailing 'Read the full article' URL into the url field and removes it from the summary", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. Fed holds rates steady",
      "The Federal Reserve announced no change to interest rates.",
      "Read the full article: https://example.com/fed",
      "",
      "2. Apple beats estimates",
      "Apple reported record quarterly revenue.",
      "Read the full article: https://example.com/apple",
      "",
      "3. Oil prices dip",
      "Crude oil fell 2% amid easing geopolitical tensions.",
      "Read the full article: https://example.com/oil",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.topNewsItems).toHaveLength(3);
    expect(result!.topNewsItems[0]).toEqual({
      number: 1,
      title: "Fed holds rates steady",
      summary: "The Federal Reserve announced no change to interest rates.",
      url: "https://example.com/fed",
    });
    expect(result!.topNewsItems[2]).toEqual({
      number: 3,
      title: "Oil prices dip",
      summary: "Crude oil fell 2% amid easing geopolitical tensions.",
      url: "https://example.com/oil",
    });
  });

  it("leaves url undefined and keeps the summary intact when no URL line is present", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 1 NEWS",
      "",
      "1. Fed holds rates steady",
      "The Federal Reserve announced no change to interest rates.",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.topNewsItems).toHaveLength(1);
    const first = result!.topNewsItems[0];
    expect(first).toBeDefined();
    expect(first!.url).toBeUndefined();
    expect(first!.summary).toBe(
      "The Federal Reserve announced no change to interest rates.",
    );
  });

  it("handles a mix of items with and without trailing URLs", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. With URL",
      "Summary one.",
      "Read the full article: https://example.com/a",
      "",
      "2. Without URL",
      "Summary two.",
      "",
      "3. With URL again",
      "Summary three.",
      "Read the full article: https://example.com/c",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.topNewsItems[0]?.url).toBe("https://example.com/a");
    expect(result!.topNewsItems[1]?.url).toBeUndefined();
    expect(result!.topNewsItems[2]?.url).toBe("https://example.com/c");
    expect(result!.topNewsItems[1]?.summary).toBe("Summary two.");
  });

  it("recognises the URL line case-insensitively", () => {
    // Setup
    const bodyText = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 1 NEWS",
      "",
      "1. Mixed case label",
      "Summary text.",
      "READ THE FULL ARTICLE: https://example.com/upper",
    ].join("\n");

    // Act
    const result = expectLegacyBody(bodyText);

    // Assert
    expect(result).toBeDefined();
    expect(result!.topNewsItems[0]?.url).toBe("https://example.com/upper");
    expect(result!.topNewsItems[0]?.summary).toBe("Summary text.");
  });
});

describe("parseNewsletterBody — industry wire", () => {
  it("parses a minimal wire body with prose disruptors", () => {
    const bodyText = [
      "MP_NEWSLETTER",
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "Week in sector",
      "PROSE",
      "Lead paragraph only.",
      "END",
      "",
      "BEGIN competitive-landscape",
      "DISPLAY_HEADING",
      "Battle lines",
      "BULLET",
      "First mover extended its lead.",
      "Read the full article: https://example.com/a",
      "BULLET",
      "Second player responded with pricing.",
      "END",
      "",
      "BEGIN deals-and-movements",
      "DISPLAY_HEADING",
      "Deals desk",
      "BULLET",
      "A regional acquisition closed.",
      "END",
      "",
      "BEGIN regulatory-policy-watch",
      "DISPLAY_HEADING",
      "Policy",
      "BULLET",
      "Agencies hinted at tighter oversight.",
      "END",
      "",
      "BEGIN disruptors-or-tech",
      "DISPLAY_HEADING",
      "Innovation",
      "FORMAT",
      "prose",
      "PROSE",
      "Founders keep shipping faster release cycles.",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Quick hits",
      "ITEM",
      "Hit one",
      "Read the full article: https://example.com/a",
      "ITEM",
      "Hit two",
      "Read the full article: https://example.com/b",
      "ITEM",
      "Hit three",
      "Read the full article: https://example.com/c",
      "ITEM",
      "Hit four",
      "Read the full article: https://example.com/a",
      "ITEM",
      "Hit five",
      "Read the full article: https://example.com/b",
      "END",
    ].join("\n");

    const result = parseNewsletterBody(bodyText);

    expect(result?.format).toBe("industry");
    if (result?.format !== "industry") {
      throw new Error("expected industry wire");
    }
    expect(result.sections).toHaveLength(6);
    expect(result.sections[0]?.machineKey).toBe("industry-pulse");
    const quick = result.sections.find((s) => s.machineKey === "quick-hits");
    expect(quick).toBeDefined();
    if (!quick || quick.machineKey !== "quick-hits") {
      throw new Error("expected quick hits");
    }
    expect(quick.items).toHaveLength(5);
    expect(quick.items[0]?.url).toBe("https://example.com/a");
  });
});
