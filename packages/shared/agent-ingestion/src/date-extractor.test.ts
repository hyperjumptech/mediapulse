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

describe("extractPublishedDate: natural-language datelines", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  it("reads an Indonesian dateline from the body", () => {
    const result = extractPublishedDate(
      { content: "Jakarta, 5 Agustus 2026 - OJK melaporkan kredit tumbuh." },
      now,
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-05");
  });

  it("reads a zero-padded Indonesian dateline", () => {
    const result = extractPublishedDate(
      { content: "Selasa, 05 Agustus 2026 14:30 WIB" },
      now,
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-05");
  });

  it("dates the December 2023 loan article that shipped as a 2026 quick hit", () => {
    const result = extractPublishedDate(
      {
        content:
          "Moratelindo menarik pinjaman Bank Mandiri Rp426 miliar. Jumat, 29 Desember 2023",
      },
      now,
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2023-12-29");
  });

  it("reads an English month-first dateline", () => {
    const result = extractPublishedDate(
      { content: "Published August 5, 2026 by the newsroom." },
      now,
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-05");
  });

  it("prefers explicit metadata over a date mentioned in the body", () => {
    const result = extractPublishedDate(
      {
        fetchMetadata: { publishedTime: "2026-08-06T01:00:00.000Z" },
        content: "Peristiwa itu terjadi pada 5 Agustus 2026.",
      },
      now,
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-06");
  });

  it("ignores a month name with no year", () => {
    const result = extractPublishedDate({ content: "Agustus mendatang." }, now);

    expect(result).toBeNull();
  });
});

describe("extractDateFromUrl: compact path dates", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  it("reads a compact YYYYMMDD path segment", () => {
    const result = extractDateFromUrl(
      "https://finansial.bisnis.com/read/20260805/563/1993809/ojk-terbitkan-pojk",
      now,
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-05");
  });

  it("reads a compact date prefixing a longer timestamp", () => {
    const result = extractDateFromUrl(
      "https://www.cnnindonesia.com/teknologi/20260805203648-213-1389079/xlsmart",
      now,
    );

    expect(result?.toISOString().slice(0, 10)).toBe("2026-08-05");
  });

  it("does not read an impossible date out of an id-like digit run", () => {
    const result = extractDateFromUrl(
      "https://www.beritajogja.com/news/187480834/bri-dukung-optimalisasi",
      now,
    );

    expect(result).toBeNull();
  });
});
