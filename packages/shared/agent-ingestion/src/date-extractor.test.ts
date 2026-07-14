/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { extractDateFromUrl, extractPublishedDate } from "./date-extractor";

describe("extractPublishedDate", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("prefers fetch metadata over content fallback", () => {
    const content =
      '"datePublished":"2015-06-01T00:00:00.000Z" article body text';

    const result = extractPublishedDate(
      {
        fetchMetadata: { publishedTime: "2026-04-12T08:00:00.000Z" },
        content,
      },
      now,
    );

    expect(result?.toISOString()).toBe("2026-04-12T08:00:00.000Z");
  });

  it("extracts JSON-LD datePublished from content when metadata is absent", () => {
    const result = extractPublishedDate(
      {
        content:
          '<script type="application/ld+json">{"datePublished":"2026-04-12T10:15:00Z"}</script>',
      },
      now,
    );

    expect(result?.toISOString()).toBe("2026-04-12T10:15:00.000Z");
  });

  it("falls back to the URL slug when metadata and content carry no date", () => {
    const result = extractPublishedDate(
      {
        content: "Plain article body without any date markers.",
        url: "https://www.tribunnews.com/bisnis/2025/06/10/some-headline-slug",
      },
      now,
    );

    expect(result?.toISOString()).toBe("2025-06-10T00:00:00.000Z");
  });

  it("rejects far-future dates outside the sanity range", () => {
    const result = extractPublishedDate(
      {
        fetchMetadata: { publishedTime: "2040-01-01T00:00:00.000Z" },
        content: "",
      },
      now,
    );

    expect(result).toBeNull();
  });

  it("rejects suspicious pre-2016 dates", () => {
    const result = extractPublishedDate(
      {
        fetchMetadata: { published_at: "2015-12-31T00:00:00.000Z" },
        content: "",
      },
      now,
    );

    expect(result).toBeNull();
  });

  it("returns null when no date signal is present", () => {
    const result = extractPublishedDate(
      {
        content: "Plain article body without any date markers.",
      },
      now,
    );

    expect(result).toBeNull();
  });
});

describe("extractDateFromUrl", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("extracts a /YYYY/MM/DD/ path date", () => {
    const result = extractDateFromUrl(
      "https://www.tribunnews.com/bisnis/2025/06/10/aman-targetkan-pendapatan",
      now,
    );

    expect(result?.toISOString()).toBe("2025-06-10T00:00:00.000Z");
  });

  it("extracts a /YYYY/MM/ path date at month precision", () => {
    const result = extractDateFromUrl("https://example.com/2026/04/story", now);

    expect(result?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("ignores non-date numeric path segments", () => {
    const result = extractDateFromUrl(
      "https://example.com/article/12345/full-story",
      now,
    );

    expect(result).toBeNull();
  });

  it("rejects a path date outside the sanity range", () => {
    const result = extractDateFromUrl(
      "https://example.com/2010/01/01/old",
      now,
    );

    expect(result).toBeNull();
  });

  it("returns null when the path carries no date", () => {
    const result = extractDateFromUrl(
      "https://example.com/news/some-headline",
      now,
    );

    expect(result).toBeNull();
  });
});
