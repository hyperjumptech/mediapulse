import { describe, expect, it } from "vitest";

import { formatNewsletterContent } from "./format-newsletter-content.js";
import { parseNewsletterJson } from "./parse-newsletter-json.js";

describe("formatNewsletterContent", () => {
  it("formats executive summary and top 3 news into plain text", () => {
    // Setup
    const executiveSummary =
      "Markets rallied on strong earnings. The Fed signaled a pause. Oil prices eased.";
    const topNews = [
      {
        title: "Tech giants beat estimates",
        summary: "Q4 results exceeded expectations.",
      },
      {
        title: "Fed holds rates",
        summary: "Central bank leaves policy unchanged.",
      },
      { title: "Crude drops below $80", summary: "Supply concerns ease." },
    ];

    // Act
    const content = formatNewsletterContent(executiveSummary, topNews);

    // Assert
    expect(content).toContain("EXECUTIVE SUMMARY");
    expect(content).toContain(executiveSummary);
    expect(content).toContain("TOP 3 NEWS");
    expect(content).toContain("1. Tech giants beat estimates");
    expect(content).toContain("Q4 results exceeded expectations.");
    expect(content).toContain("2. Fed holds rates");
    expect(content).toContain("3. Crude drops below $80");
    expect(content).toContain("---");
  });

  it("trims summary and item text", () => {
    // Setup
    const executiveSummary = "  Summary with spaces.  ";
    const topNews = [{ title: "  Headline  ", summary: "  Brief.  " }];

    // Act
    const content = formatNewsletterContent(executiveSummary, topNews);

    // Assert
    expect(content).toContain("Summary with spaces.");
    expect(content).toContain("1.   Headline  ");
    expect(content).toContain("Brief.");
  });

  it("handles fewer than 3 items", () => {
    // Setup
    const topNews = [{ title: "Only one", summary: "Single item." }];

    // Act
    const content = formatNewsletterContent("Summary.", topNews);

    // Assert
    expect(content).toContain("1. Only one");
    expect(content).not.toContain("2.");
  });
});

describe("parseNewsletterJson", () => {
  it("parses valid newsletter JSON", () => {
    // Setup
    const raw = JSON.stringify({
      subject: "Daily Brief",
      executiveSummary: "Markets up.",
      topNews: [{ title: "Headline", summary: "Summary text." }],
    });

    // Act
    const result = parseNewsletterJson(raw);

    // Assert
    expect(result.subject).toBe("Daily Brief");
    expect(result.executiveSummary).toBe("Markets up.");
    expect(result.topNews).toHaveLength(1);
    expect(result.topNews?.[0]?.title).toBe("Headline");
  });

  it("throws when JSON is malformed", () => {
    // Act & Assert
    expect(() => parseNewsletterJson("not valid json")).toThrow(
      "OpenAI returned invalid JSON",
    );
  });

  it("throws when topNews item has invalid shape", () => {
    // Setup: topNews item missing required title/summary strings
    const raw = JSON.stringify({
      subject: "x",
      executiveSummary: "y",
      topNews: [{ title: 123, summary: "ok" }],
    });

    // Act & Assert
    expect(() => parseNewsletterJson(raw)).toThrow();
  });
});
