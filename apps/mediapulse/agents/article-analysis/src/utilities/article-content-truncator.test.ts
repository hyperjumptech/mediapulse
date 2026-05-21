/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  allocateBudget,
  dropBoilerplateParagraphs,
  scoreParagraphForTicker,
  splitParagraphs,
  truncateArticleForExtraction,
} from "./article-content-truncator.js";

describe("splitParagraphs", () => {
  it("splits on double newlines and drops empty blocks", () => {
    // Act
    const paragraphs = splitParagraphs("One\n\nTwo\n\n\nThree");

    // Assert
    expect(paragraphs).toEqual(["One", "Two", "Three"]);
  });

  it("falls back to sentence boundaries when no paragraph breaks exist", () => {
    // Act
    const paragraphs = splitParagraphs(
      "First sentence here. Second sentence starts now.",
    );

    // Assert
    expect(paragraphs).toEqual([
      "First sentence here.",
      "Second sentence starts now.",
    ]);
  });
});

describe("dropBoilerplateParagraphs", () => {
  it("removes short fragments and footer chrome", () => {
    // Act
    const kept = dropBoilerplateParagraphs([
      "Real lead paragraph with enough length to survive the filter.",
      "Newsletter signup",
      "Home · Markets · Tech · About",
    ]);

    // Assert
    expect(kept).toEqual([
      "Real lead paragraph with enough length to survive the filter.",
    ]);
  });
});

describe("scoreParagraphForTicker", () => {
  it("adds higher score for ticker symbols than aliases", () => {
    // Act
    const symbolScore = scoreParagraphForTicker(
      "Shares of AAPL rose after earnings.",
      ["AAPL"],
      ["Apple Inc"],
    );
    const aliasScore = scoreParagraphForTicker(
      "Apple Inc reported revenue growth.",
      ["AAPL"],
      ["Apple Inc"],
    );

    // Assert
    expect(symbolScore).toBeGreaterThan(aliasScore);
  });
});

describe("truncateArticleForExtraction", () => {
  it("keeps the headline and lead paragraphs under a tight budget", () => {
    // Setup
    const raw = [
      "Title",
      "",
      "Lead paragraph one with enough words to count as real content.",
      "",
      "Lead paragraph two with enough words to count as real content.",
      "",
      "Boilerplate footer",
      "",
      "Newsletter signup",
      "",
      "More content that should not fit in the budget.",
    ].join("\n");

    // Act
    const result = truncateArticleForExtraction(raw, {
      maxChars: 180,
      tickerSymbols: [],
      companyAliases: [],
      leadParagraphsAlwaysKept: 2,
    });

    // Assert
    expect(result.content).toContain("Title");
    expect(result.content).toContain("Lead paragraph one");
    expect(result.content).toContain("Lead paragraph two");
    expect(result.content).not.toContain("Newsletter signup");
    expect(result.content).not.toContain("Boilerplate footer");
  });

  it("prioritizes ticker-anchored paragraphs after the lead", () => {
    // Setup
    const raw = [
      "Ticker priority headline",
      "",
      "Lead paragraph one without ticker mention in this opening block.",
      "",
      "Lead paragraph two without ticker mention in this opening block.",
      "",
      "Filler paragraph three has generic market commentary only here.",
      "",
      "Filler paragraph four has generic market commentary only here.",
      "",
      "Apple reported earnings and AAPL shares rose on guidance today.",
      "",
      "More filler paragraph six with extra detail that should stay out.",
    ].join("\n");

    // Act
    const result = truncateArticleForExtraction(raw, {
      maxChars: 230,
      tickerSymbols: ["AAPL"],
      companyAliases: ["Apple Inc"],
      leadParagraphsAlwaysKept: 2,
    });

    // Assert
    expect(result.content).toContain("Ticker priority headline");
    expect(result.content).toContain("Lead paragraph one");
    expect(result.content).toContain("Lead paragraph two");
    expect(result.content).toContain("AAPL shares rose");
    expect(result.content).not.toContain("Filler paragraph three");
    expect(result.content).not.toContain("Filler paragraph four");
  });

  it("returns cleaned content unchanged when the budget exceeds body length", () => {
    // Setup
    const raw = [
      "Headline",
      "",
      "Lead paragraph one with enough words to count as real content.",
      "",
      "Lead paragraph two with enough words to count as real content.",
      "",
      "Newsletter signup",
      "",
      "Closing paragraph with enough words to count as real content here.",
    ].join("\n");
    const expectedCleaned = [
      "Headline",
      "Lead paragraph one with enough words to count as real content.",
      "Lead paragraph two with enough words to count as real content.",
      "Closing paragraph with enough words to count as real content here.",
    ].join("\n\n");

    // Act
    const result = truncateArticleForExtraction(raw, {
      maxChars: expectedCleaned.length + 500,
      tickerSymbols: [],
      companyAliases: [],
      leadParagraphsAlwaysKept: 2,
    });

    // Assert
    expect(result.content).toBe(expectedCleaned);
  });
});

describe("allocateBudget", () => {
  it("keeps higher-scored paragraphs before lower-scored ones", () => {
    // Act
    const allocated = allocateBudget(
      null,
      ["Low score paragraph here.", "AAPL beat earnings expectations."],
      [0, 3],
      40,
      0,
    );

    // Assert
    expect(allocated.content).toBe("AAPL beat earnings expectations.");
  });
});
