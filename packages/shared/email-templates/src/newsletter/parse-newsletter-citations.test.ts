import { describe, expect, it } from "vitest";

import {
  parseNewsletterCitations,
  unwrapInlineFormatting,
} from "./parse-newsletter-citations.js";

describe("unwrapInlineFormatting", () => {
  it("strips surrounding **bold**", () => {
    expect(unwrapInlineFormatting("**Apple earnings**")).toBe("Apple earnings");
  });

  it("strips surrounding *italic*", () => {
    expect(unwrapInlineFormatting("*Apple earnings*")).toBe("Apple earnings");
  });

  it("strips a nested __bold__ inside **wrapper**", () => {
    expect(unwrapInlineFormatting("**__Apple Q2__**")).toBe("Apple Q2");
  });

  it("returns input unchanged when nothing wraps it", () => {
    expect(unwrapInlineFormatting("Apple Q2 earnings")).toBe(
      "Apple Q2 earnings",
    );
  });
});

describe("parseNewsletterCitations", () => {
  it("returns [] for empty input", () => {
    expect(parseNewsletterCitations("")).toStrictEqual([]);
  });

  it("returns [] for input with no links", () => {
    expect(
      parseNewsletterCitations("EXECUTIVE SUMMARY\n\nNo links today."),
    ).toStrictEqual([]);
  });

  it("extracts markdown links and unwraps formatting in titles", () => {
    const body = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied — see [**Apple Q2 earnings**](https://example.com/aapl-q2).",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. Apple",
      "Summary.",
    ].join("\n");

    const citations = parseNewsletterCitations(body);

    expect(citations).toStrictEqual([
      {
        title: "Apple Q2 earnings",
        url: "https://example.com/aapl-q2",
        domain: "example.com",
      },
    ]);
  });

  it("pairs Read-the-full-article URLs with top-news item titles", () => {
    const body = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied.",
      "",
      "---",
      "",
      "TOP 2 NEWS",
      "",
      "1. Apple Q2 earnings",
      "Apple posted Q2 numbers.",
      "Read the full article: https://example.com/aapl-q2",
      "",
      "2. Tesla deliveries",
      "Tesla deliveries beat estimates.",
      "Read the full article: https://example.com/tsla-q2",
    ].join("\n");

    const citations = parseNewsletterCitations(body);

    expect(citations).toStrictEqual([
      {
        title: "Apple Q2 earnings",
        url: "https://example.com/aapl-q2",
        domain: "example.com",
      },
      {
        title: "Tesla deliveries",
        url: "https://example.com/tsla-q2",
        domain: "example.com",
      },
    ]);
  });

  it("deduplicates by URL while preserving the first occurrence", () => {
    const body = [
      "Read [Apple](https://example.com/aapl) and again [Apple again](https://example.com/aapl).",
      "Read the full article: https://example.com/aapl",
    ].join("\n");

    const citations = parseNewsletterCitations(body);

    expect(citations).toStrictEqual([
      {
        title: "Apple",
        url: "https://example.com/aapl",
        domain: "example.com",
      },
    ]);
  });

  it("falls back to the URL as title for read-the-full-article links without an item", () => {
    const body = "Read the full article: https://example.com/standalone";

    const citations = parseNewsletterCitations(body);

    expect(citations).toStrictEqual([
      {
        title: "https://example.com/standalone",
        url: "https://example.com/standalone",
        domain: "example.com",
      },
    ]);
  });

  it("does not throw on malformed markdown links", () => {
    const body = "Half-link [missing close (https://example.com/x)";
    expect(() => parseNewsletterCitations(body)).not.toThrow();
    expect(parseNewsletterCitations(body)).toStrictEqual([]);
  });

  it("includes both markdown and Read-the-full-article links in document order", () => {
    const body = [
      "Markets rallied — see [Apple](https://example.com/aapl).",
      "",
      "---",
      "",
      "TOP 1 NEWS",
      "",
      "1. Tesla deliveries",
      "Tesla deliveries beat estimates.",
      "Read the full article: https://example.com/tsla",
    ].join("\n");

    const citations = parseNewsletterCitations(body);

    expect(citations.map((c) => c.url)).toStrictEqual([
      "https://example.com/aapl",
      "https://example.com/tsla",
    ]);
  });

  it("pairs read-the-full-article URLs in v2 wire bodies with quick-hit text titles", () => {
    const body = [
      "MP_NEWSLETTER_V2",
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "Lead",
      "PROSE",
      "Intro.",
      "END",
      "",
      "BEGIN competitive-landscape",
      "DISPLAY_HEADING",
      "C",
      "BULLET",
      "b1",
      "BULLET",
      "b2",
      "END",
      "",
      "BEGIN deals-and-movements",
      "DISPLAY_HEADING",
      "D",
      "BULLET",
      "d1",
      "END",
      "",
      "BEGIN regulatory-policy-watch",
      "DISPLAY_HEADING",
      "R",
      "BULLET",
      "r1",
      "END",
      "",
      "BEGIN disruptors-or-tech",
      "DISPLAY_HEADING",
      "X",
      "FORMAT",
      "prose",
      "PROSE",
      "p",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Q",
      "ITEM",
      "Apple beat",
      "Read the full article: https://example.com/aapl-q2",
      "ITEM",
      "Tesla beat",
      "Read the full article: https://example.com/tsla-q2",
      "ITEM",
      "h3",
      "Read the full article: https://example.com/a",
      "ITEM",
      "h4",
      "Read the full article: https://example.com/b",
      "ITEM",
      "h5",
      "Read the full article: https://example.com/c",
      "END",
    ].join("\n");

    const citations = parseNewsletterCitations(body);

    expect(citations.map((c) => c.url)).toStrictEqual([
      "https://example.com/aapl-q2",
      "https://example.com/tsla-q2",
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ]);
    expect(citations[0]?.title).toBe("Apple beat");
    expect(citations[1]?.title).toBe("Tesla beat");
  });
});
