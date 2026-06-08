import { describe, it, expect, vi } from "vitest";
import type got from "got";

import { sitemapStrategy } from "./sitemap";
import { RateLimiter } from "../resilience";

const STANDARD_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/articles/first</loc>
    <lastmod>2024-04-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/articles/second</loc>
    <lastmod>2024-04-02</lastmod>
  </url>
</urlset>`;

const NEWS_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://example.com/news/breaking</loc>
    <lastmod>2024-05-10</lastmod>
    <news:news>
      <news:title>Breaking News Today</news:title>
      <news:publication_date>2024-05-10T08:00:00Z</news:publication_date>
    </news:news>
  </url>
</urlset>`;

const buildDeps = (body: string) => ({
  gotClient: {
    get: vi.fn().mockResolvedValue({ statusCode: 200, body }),
  } as unknown as typeof got,
  rateLimiter: new RateLimiter(100, 1),
  logger: { info: vi.fn(), warn: vi.fn() },
});

describe("sitemapStrategy", () => {
  it("parses a standard sitemap with loc and lastmod", async () => {
    const deps = buildDeps(STANDARD_SITEMAP);
    const items = await sitemapStrategy.discover(
      "https://example.com/sitemap.xml",
      deps,
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: "https://example.com/articles/first",
      publishedAt: "2024-04-01T00:00:00.000Z",
    });
    expect(items[0]?.title).toBeUndefined();
  });

  it("parses a news sitemap using news:title and lastmod", async () => {
    const deps = buildDeps(NEWS_SITEMAP);
    const items = await sitemapStrategy.discover(
      "https://example.com/news-sitemap.xml",
      deps,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://example.com/news/breaking",
      title: "Breaking News Today",
      publishedAt: "2024-05-10T00:00:00.000Z",
    });
  });

  it("throws a classified error on malformed XML", async () => {
    const deps = buildDeps("<broken><unclosed>");
    await expect(
      sitemapStrategy.discover("https://example.com/sitemap.xml", deps),
    ).rejects.toMatchObject({ errorCategory: "provider_data_invalid" });
  });

  it("throws a classified error when XML has no urlset", async () => {
    const deps = buildDeps(
      "<notasitemap><url><loc>x</loc></url></notasitemap>",
    );
    await expect(
      sitemapStrategy.discover("https://example.com/sitemap.xml", deps),
    ).rejects.toMatchObject({ errorCategory: "provider_data_invalid" });
  });
});
