/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { insertDataSourcesIdempotently } from "./insert-data-sources-idempotently";

describe("insertDataSourcesIdempotently", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts only rows that were inserted", async () => {
    // Setup
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "1" })
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce({ id: "3" });

    // Act
    const inserted = await insertDataSourcesIdempotently(
      [
        {
          url: "https://example.com/a",
          canonicalUrl: "https://example.com/a",
          title: "A",
          content: "A",
        },
        {
          url: "https://example.com/b",
          canonicalUrl: "https://example.com/b",
          title: "B",
          content: "B",
        },
        {
          url: "https://example.com/c",
          canonicalUrl: "https://example.com/c",
          title: "C",
          content: "C",
        },
      ],
      { dataSource: { create } },
    );

    // Assert
    expect(inserted).toBe(2);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("stamps the registrable domain from the canonical url", async () => {
    // Setup
    const create = vi.fn().mockResolvedValue({ id: "1" });

    // Act
    await insertDataSourcesIdempotently(
      [
        {
          url: "https://finance.detik.com/berita/a?utm_source=x",
          canonicalUrl: "https://finance.detik.com/berita/a",
          title: "A",
          content: "A",
        },
        {
          url: "https://momsmoney.kontan.co.id/news/b",
          canonicalUrl: "https://momsmoney.kontan.co.id/news/b",
          title: "B",
          content: "B",
        },
      ],
      { dataSource: { create } },
    );

    // Assert
    expect(create.mock.calls[0]?.[0].data.registrableDomain).toBe("detik.com");
    expect(create.mock.calls[1]?.[0].data.registrableDomain).toBe(
      "kontan.co.id",
    );
  });

  it("keeps a registrable domain supplied by the caller", async () => {
    // Setup
    const create = vi.fn().mockResolvedValue({ id: "1" });

    // Act
    await insertDataSourcesIdempotently(
      [
        {
          url: "https://news.google.com/rss/articles/CBMirgFBVV95cUxN",
          canonicalUrl: "https://news.google.com/rss/articles/CBMirgFBVV95cUxN",
          title: "A",
          content: "A",
          registrableDomain: "kontan.co.id",
        },
      ],
      { dataSource: { create } },
    );

    // Assert
    expect(create.mock.calls[0]?.[0].data.registrableDomain).toBe(
      "kontan.co.id",
    );
  });

  it("omits the registrable domain when the url is unparsable", async () => {
    // Setup
    const create = vi.fn().mockResolvedValue({ id: "1" });

    // Act
    await insertDataSourcesIdempotently(
      [
        {
          url: "not a url",
          canonicalUrl: "not a url",
          title: "A",
          content: "A",
        },
      ],
      { dataSource: { create } },
    );

    // Assert
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty(
      "registrableDomain",
    );
  });

  it("rethrows non-unique Prisma errors", async () => {
    // Setup
    const create = vi.fn().mockRejectedValue({ code: "P2003" });

    // Act / Assert
    await expect(
      insertDataSourcesIdempotently(
        [
          {
            url: "https://example.com/a",
            canonicalUrl: "https://example.com/a",
            title: "A",
            content: "A",
          },
        ],
        { dataSource: { create } },
      ),
    ).rejects.toEqual({ code: "P2003" });
  });
});
