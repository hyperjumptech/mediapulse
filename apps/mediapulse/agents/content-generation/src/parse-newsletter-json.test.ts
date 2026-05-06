import { describe, expect, it } from "vitest";

import { parseNewsletterJson } from "./parse-newsletter-json.js";

describe("parseNewsletterJson", () => {
  it("parses valid topNews items with plain summary", () => {
    // Act
    const parsed = parseNewsletterJson(
      JSON.stringify({
        subject: "Daily Brief",
        executiveSummary: "Summary",
        topNews: [
          {
            title: "Story 1",
            summary: "Bank reported strong quarterly earnings growth.",
          },
        ],
      }),
      3,
    );

    // Assert
    expect(parsed.topNews[0]?.title).toBe("Story 1");
    expect(parsed.topNews[0]?.summary).toBe(
      "Bank reported strong quarterly earnings growth.",
    );
  });

  it("rejects topNews items that exceed topNewsCount", () => {
    // Act & Assert
    expect(() =>
      parseNewsletterJson(
        JSON.stringify({
          subject: "Daily Brief",
          executiveSummary: "Summary",
          topNews: [
            { title: "Story 1", summary: "s1" },
            { title: "Story 2", summary: "s2" },
            { title: "Story 3", summary: "s3" },
            { title: "Story 4", summary: "s4" },
          ],
        }),
        3,
      ),
    ).toThrow("Expected at most 3 topNews items");
  });

  it("rejects input where topNews item is missing summary", () => {
    // Act & Assert
    expect(() =>
      parseNewsletterJson(
        JSON.stringify({
          subject: "Daily Brief",
          executiveSummary: "Summary",
          topNews: [{ title: "Story 1" }],
        }),
        3,
      ),
    ).toThrow();
  });

  it("accepts an empty topNews array", () => {
    // Act
    const parsed = parseNewsletterJson(
      JSON.stringify({
        subject: "Daily Brief",
        executiveSummary: "Summary",
        topNews: [],
      }),
      3,
    );

    // Assert
    expect(parsed.topNews).toEqual([]);
  });

  it("throws when given invalid JSON", () => {
    // Act & Assert
    expect(() => parseNewsletterJson("{not valid json}", 3)).toThrow(
      "OpenAI returned invalid JSON",
    );
  });
});
