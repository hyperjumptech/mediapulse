import { describe, expect, it } from "vitest";

import { parseNewsletterJson } from "./parse-newsletter-json.js";

describe("parseNewsletterJson", () => {
  it("parses valid topNews items with summaryWithLinks and citations", () => {
    const parsed = parseNewsletterJson(
      JSON.stringify({
        subject: "Daily Brief",
        executiveSummary: "Summary",
        topNews: [
          {
            title: "Story 1",
            summaryWithLinks: "Update [Source](https://example.com/a).",
            citations: [{ url: "https://example.com/a", label: "Source" }],
          },
        ],
      }),
      3,
    );

    expect(parsed.topNews[0]?.summaryWithLinks).toContain("[Source]");
    expect(parsed.topNews[0]?.citations[0]?.url).toBe("https://example.com/a");
  });

  it("rejects topNews item without citations", () => {
    expect(() =>
      parseNewsletterJson(
        JSON.stringify({
          subject: "Daily Brief",
          executiveSummary: "Summary",
          topNews: [
            {
              title: "Story 1",
              summaryWithLinks: "Update [Source](https://example.com/a).",
              citations: [],
            },
          ],
        }),
        3,
      ),
    ).toThrow();
  });

  it("rejects citation with invalid URL", () => {
    expect(() =>
      parseNewsletterJson(
        JSON.stringify({
          subject: "Daily Brief",
          executiveSummary: "Summary",
          topNews: [
            {
              title: "Story 1",
              summaryWithLinks: "Update [Source](bad-url).",
              citations: [{ url: "bad-url" }],
            },
          ],
        }),
        3,
      ),
    ).toThrow();
  });
});
