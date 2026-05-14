import { describe, expect, it } from "vitest";

import {
  formatNewsletterContent,
  READ_FULL_ARTICLE_LABEL,
} from "./format-newsletter-content.js";

describe("formatNewsletterContent", () => {
  it("renders the executive summary block followed by the TOP N NEWS heading", () => {
    // Setup
    const summary = "Markets rallied broadly today.";
    const items = [
      {
        title: "Tech leads",
        summary: "Tech stocks led the rally.",
        url: "https://example.com/a",
      },
    ];

    // Act
    const result = formatNewsletterContent(summary, items, 1);

    // Assert
    expect(result.startsWith("EXECUTIVE SUMMARY\n\n")).toBe(true);
    expect(result).toContain("Markets rallied broadly today.");
    expect(result).toContain("\n---\n\nTOP 1 NEWS\n\n");
  });

  it("defaults the heading count to 3 when not provided", () => {
    // Setup & Act
    const result = formatNewsletterContent("summary", []);

    // Assert
    expect(result).toContain("TOP 3 NEWS");
  });

  it("appends a 'Read the full article' line for each item with a URL", () => {
    // Setup
    const items = [
      {
        title: "First",
        summary: "First summary.",
        url: "https://example.com/a",
      },
      {
        title: "Second",
        summary: "Second summary.",
        url: "https://example.com/b",
      },
      {
        title: "Third",
        summary: "Third summary.",
        url: "https://example.com/c",
      },
    ];

    // Act
    const result = formatNewsletterContent("Summary.", items, 3);

    // Assert
    expect(result).toContain(
      `${READ_FULL_ARTICLE_LABEL}: https://example.com/a`,
    );
    expect(result).toContain(
      `${READ_FULL_ARTICLE_LABEL}: https://example.com/b`,
    );
    expect(result).toContain(
      `${READ_FULL_ARTICLE_LABEL}: https://example.com/c`,
    );
    expect(result).toContain(
      "1. First\nFirst summary.\nRead the full article: https://example.com/a",
    );
  });

  it("omits the source line for items without a URL", () => {
    // Setup
    const items = [
      { title: "First", summary: "First summary.", url: "https://a.test/" },
      { title: "Second", summary: "Second summary." },
      { title: "Third", summary: "Third summary.", url: "   " },
    ];

    // Act
    const result = formatNewsletterContent("Summary.", items, 3);

    // Assert
    expect(result).toContain(`${READ_FULL_ARTICLE_LABEL}: https://a.test/`);
    expect(result).not.toMatch(/Second summary\.\nRead the full article:/);
    expect(result).not.toMatch(/Third summary\.\nRead the full article:/);
  });

  it("trims whitespace around the URL", () => {
    // Setup
    const items = [
      {
        title: "T",
        summary: "S.",
        url: "  https://example.com/trimmed  ",
      },
    ];

    // Act
    const result = formatNewsletterContent("Summary.", items, 1);

    // Assert
    expect(result).toContain(
      `${READ_FULL_ARTICLE_LABEL}: https://example.com/trimmed`,
    );
  });

  it("trims whitespace around each summary", () => {
    // Setup
    const items = [{ title: "T", summary: "  Padded summary.  " }];

    // Act
    const result = formatNewsletterContent("Summary.", items, 1);

    // Assert
    expect(result).toContain("1. T\nPadded summary.");
    expect(result).not.toContain("  Padded summary.  ");
  });

  it("separates consecutive items with a blank line", () => {
    // Setup
    const items = [
      { title: "First", summary: "S1.", url: "https://a.test/" },
      { title: "Second", summary: "S2.", url: "https://b.test/" },
    ];

    // Act
    const result = formatNewsletterContent("Summary.", items, 2);

    // Assert
    expect(result).toContain(
      "1. First\nS1.\nRead the full article: https://a.test/\n\n2. Second",
    );
  });
});
