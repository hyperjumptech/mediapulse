import { describe, expect, it } from "vitest";

import {
  expandSourceUrl,
  looksLikeFeedUrl,
  looksLikeSitemapUrl,
} from "./expand-source-urls";

describe("looksLikeSitemapUrl", () => {
  it("detects sitemap URLs", () => {
    expect(looksLikeSitemapUrl("https://example.com/sitemap.xml")).toBe(true);
    expect(looksLikeSitemapUrl("https://example.com/news")).toBe(false);
  });
});

describe("looksLikeFeedUrl", () => {
  it("detects feed URLs", () => {
    expect(looksLikeFeedUrl("https://example.com/feed")).toBe(true);
    expect(looksLikeFeedUrl("https://example.com/article")).toBe(false);
  });
});

describe("expandSourceUrl", () => {
  it("returns the URL itself for a regular web page", async () => {
    const url = "https://example.com/article/one";
    const items = await expandSourceUrl(url, {
      gotClient: {
        get: async () => ({ body: "", statusCode: 200 }),
      } as never,
      rateLimiter: { acquire: async () => {} } as never,
      logger: { info: () => {}, warn: () => {}, error: () => {} } as never,
      timeoutMs: 5000,
      concurrency: 1,
    });

    expect(items).toEqual([{ url }]);
  });
});
