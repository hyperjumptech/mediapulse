/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { extractPublishedDate } from "./date-extractor";

describe("extractPublishedDate", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("prefers Jina metadata over content fallback", () => {
    const content =
      '"datePublished":"2015-06-01T00:00:00.000Z" article body text';

    const result = extractPublishedDate(
      {
        jinaMetadata: { publishedTime: "2026-04-12T08:00:00.000Z" },
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

  it("rejects far-future dates outside the sanity range", () => {
    const result = extractPublishedDate(
      {
        jinaMetadata: { publishedTime: "2040-01-01T00:00:00.000Z" },
        content: "",
      },
      now,
    );

    expect(result).toBeNull();
  });

  it("rejects suspicious pre-2016 dates", () => {
    const result = extractPublishedDate(
      {
        jinaMetadata: { published_at: "2015-12-31T00:00:00.000Z" },
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
