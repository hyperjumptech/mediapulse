import { describe, expect, it } from "vitest";

import {
  parseNewsletterCitations,
  unwrapInlineFormatting,
} from "./parse-newsletter-citations.js";
import type { NewsletterDocument } from "./newsletter-document.js";

/**
 * Serializes a type-checked newsletter document into a stored body string.
 *
 * @param sections - Sections of a valid document.
 * @returns The body string as it would be stored in `Newsletter.content`.
 */
const buildDocumentBody = (sections: NewsletterDocument["sections"]): string =>
  JSON.stringify({ version: 1, sections } satisfies NewsletterDocument);

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
      parseNewsletterCitations("Morning briefing.\n\nNo links today."),
    ).toStrictEqual([]);
  });

  it("extracts markdown links and unwraps formatting in titles", () => {
    const body = [
      "Morning briefing.",
      "",
      "Markets rallied — see [**Apple Q2 earnings**](https://example.com/aapl-q2).",
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
      "Tesla deliveries beat estimates.",
      "Read the full article: https://example.com/tsla",
    ].join("\n");

    const citations = parseNewsletterCitations(body);

    expect(citations.map((c) => c.url)).toStrictEqual([
      "https://example.com/aapl",
      "https://example.com/tsla",
    ]);
  });

  it("pairs read-the-full-article URLs in document bodies with quick-hit article titles", () => {
    // Setup: the URL is followed by more prose so the trailing JSON quote stays out of the match.
    const body = buildDocumentBody([
      {
        key: "quick-hits",
        articles: [
          {
            title: "Apple beat",
            url: "https://example.com/aapl-q2",
            points: [
              "Read the full article: https://example.com/aapl-q2 for detail.",
            ],
          },
          {
            title: "Tesla beat",
            url: "https://example.com/tsla-q2",
            points: [
              "Read the full article: https://example.com/tsla-q2 for detail.",
            ],
          },
        ],
      },
    ]);

    const citations = parseNewsletterCitations(body);

    expect(citations.map((citation) => citation.url)).toStrictEqual([
      "https://example.com/aapl-q2",
      "https://example.com/tsla-q2",
    ]);
    expect(citations[0]?.title).toBe("Apple beat");
    expect(citations[1]?.title).toBe("Tesla beat");
  });

  it("cites the article title, not a markdown link inside a point", () => {
    const body = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Apple posts a record quarter",
            source: "Market Wire",
            url: "https://example.com/aapl-q2",
            points: [
              "See [**Apple Q2 earnings**](https://example.com/aapl-q2)",
            ],
          },
        ],
      },
    ]);

    const citations = parseNewsletterCitations(body);

    expect(citations).toHaveLength(1);
    expect(citations[0]?.url).toBe("https://example.com/aapl-q2");
    expect(citations[0]?.domain).toBe("example.com");
    expect(citations[0]?.title).toBe("Apple posts a record quarter");
  });

  it("cites every article in a document even when no point carries a link", () => {
    const body = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Sector holds steady",
            url: "https://example.com/pulse",
            points: ["Volumes were flat week over week."],
          },
        ],
      },
    ]);

    const citations = parseNewsletterCitations(body);

    expect(citations).toStrictEqual([
      {
        title: "Sector holds steady",
        url: "https://example.com/pulse",
        domain: "example.com",
      },
    ]);
  });
});
