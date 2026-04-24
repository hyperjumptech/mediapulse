import { afterEach, describe, expect, it, vi } from "vitest";

import { formatNewsletterContent } from "./format-newsletter-content.js";
import { parseNewsletterJson } from "./parse-newsletter-json.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatNewsletterContent", () => {
  it("formats executive summary and top 3 news into plain text", () => {
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

    const content = formatNewsletterContent(executiveSummary, topNews, 3);

    expect(content).toContain("EXECUTIVE SUMMARY");
    expect(content).toContain(executiveSummary);
    expect(content).toContain("TOP 3 NEWS");
    expect(content).toContain("1. Tech giants beat estimates");
    expect(content).toContain("Q4 results exceeded expectations.");
    expect(content).toContain("2. Fed holds rates");
    expect(content).toContain("3. Crude drops below $80");
    expect(content).toContain("---");
  });

  it("formats with topNewsCount=5 producing TOP 5 NEWS heading", () => {
    const topNews = [
      { title: "Story 1", summary: "Summary 1." },
      { title: "Story 2", summary: "Summary 2." },
      { title: "Story 3", summary: "Summary 3." },
      { title: "Story 4", summary: "Summary 4." },
      { title: "Story 5", summary: "Summary 5." },
    ];

    const content = formatNewsletterContent("Summary.", topNews, 5);

    expect(content).toContain("TOP 5 NEWS");
    expect(content).toContain("5. Story 5");
  });

  it("trims summary and item text", () => {
    const executiveSummary = "  Summary with spaces.  ";
    const topNews = [{ title: "  Headline  ", summary: "  Brief.  " }];

    const content = formatNewsletterContent(executiveSummary, topNews);

    expect(content).toContain("Summary with spaces.");
    expect(content).toContain("1.   Headline  ");
    expect(content).toContain("Brief.");
  });

  it("handles fewer items than topNewsCount", () => {
    const topNews = [{ title: "Only one", summary: "Single item." }];

    const content = formatNewsletterContent("Summary.", topNews);

    expect(content).toContain("1. Only one");
    expect(content).not.toContain("2.");
  });

  it("defaults topNewsCount to 3", () => {
    const topNews = [{ title: "A", summary: "B." }];

    const content = formatNewsletterContent("Summary.", topNews);

    expect(content).toContain("TOP 3 NEWS");
  });
});

describe("parseNewsletterJson", () => {
  it("parses valid newsletter JSON", () => {
    const raw = JSON.stringify({
      subject: "Daily Brief",
      executiveSummary: "Markets up.",
      topNews: [{ title: "Headline", summary: "Summary text." }],
    });

    const result = parseNewsletterJson(raw);

    expect(result.subject).toBe("Daily Brief");
    expect(result.executiveSummary).toBe("Markets up.");
    expect(result.topNews).toHaveLength(1);
    expect(result.topNews?.[0]?.title).toBe("Headline");
  });

  it("throws when JSON is malformed", () => {
    expect(() => parseNewsletterJson("not valid json")).toThrow(
      "OpenAI returned invalid JSON",
    );
  });

  it("throws when topNews item has invalid shape", () => {
    const raw = JSON.stringify({
      subject: "x",
      executiveSummary: "y",
      topNews: [{ title: 123, summary: "ok" }],
    });

    expect(() => parseNewsletterJson(raw)).toThrow();
  });

  it("accepts topNews with exactly topNewsCount items", () => {
    const raw = JSON.stringify({
      topNews: [
        { title: "A", summary: "a" },
        { title: "B", summary: "b" },
        { title: "C", summary: "c" },
      ],
    });

    const result = parseNewsletterJson(raw, 3);

    expect(result.topNews).toHaveLength(3);
  });

  it("accepts topNews with fewer than topNewsCount items", () => {
    const raw = JSON.stringify({
      topNews: [{ title: "A", summary: "a" }],
    });

    const result = parseNewsletterJson(raw, 5);

    expect(result.topNews).toHaveLength(1);
  });

  it("rejects topNews exceeding topNewsCount", () => {
    const raw = JSON.stringify({
      topNews: [
        { title: "A", summary: "a" },
        { title: "B", summary: "b" },
        { title: "C", summary: "c" },
        { title: "D", summary: "d" },
      ],
    });

    expect(() => parseNewsletterJson(raw, 3)).toThrow(
      "Expected at most 3 topNews items, got 4",
    );
  });

  it("defaults topNewsCount to 3 when not specified", () => {
    const raw = JSON.stringify({
      topNews: [
        { title: "A", summary: "a" },
        { title: "B", summary: "b" },
        { title: "C", summary: "c" },
        { title: "D", summary: "d" },
      ],
    });

    expect(() => parseNewsletterJson(raw)).toThrow(
      "Expected at most 3 topNews items, got 4",
    );
  });
});
