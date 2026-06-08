import { describe, it, expect, vi } from "vitest";
import { RequestError } from "got";
import type got from "got";

import { genericLinksStrategy } from "./generic-links";
import { RateLimiter } from "../resilience";

const LISTING_HTML = `<!DOCTYPE html>
<html>
<head><title>News</title></head>
<body>
  <nav>
    <a href="/category/markets">Markets</a>
    <a href="/tag/finance">Finance</a>
    <a href="/">Home</a>
  </nav>
  <main>
    <a href="/articles/apple-q4-results">Apple Q4 Results</a>
    <a href="/articles/fed-rate-decision">Fed Rate Decision</a>
    <a href="https://otherdomain.com/article/external">External Article</a>
    <a href="/articles/apple-q4-results">Apple Q4 Results (duplicate)</a>
  </main>
</body>
</html>`;

const buildDeps = (html: string) => ({
  gotClient: {
    get: vi.fn().mockResolvedValue({ statusCode: 200, body: html }),
  } as unknown as typeof got,
  rateLimiter: new RateLimiter(100, 1),
  logger: { info: vi.fn(), warn: vi.fn() },
});

describe("genericLinksStrategy", () => {
  it("extracts same-host article links and drops nav/noisy paths", async () => {
    const deps = buildDeps(LISTING_HTML);
    const items = await genericLinksStrategy.discover(
      "https://example.com/news",
      deps,
    );

    const urls = items.map((item) => item.url);
    expect(urls).toContain("https://example.com/articles/apple-q4-results");
    expect(urls).toContain("https://example.com/articles/fed-rate-decision");
    expect(urls.every((url) => url.startsWith("https://example.com"))).toBe(
      true,
    );
  });

  it("drops cross-origin links", async () => {
    const deps = buildDeps(LISTING_HTML);
    const items = await genericLinksStrategy.discover(
      "https://example.com/news",
      deps,
    );

    expect(items.some((item) => item.url.includes("otherdomain.com"))).toBe(
      false,
    );
  });

  it("drops noisy paths like /category/ and /tag/", async () => {
    const deps = buildDeps(LISTING_HTML);
    const items = await genericLinksStrategy.discover(
      "https://example.com/news",
      deps,
    );

    expect(items.some((item) => item.url.includes("/category/"))).toBe(false);
    expect(items.some((item) => item.url.includes("/tag/"))).toBe(false);
  });

  it("deduplicates same URLs", async () => {
    const deps = buildDeps(LISTING_HTML);
    const items = await genericLinksStrategy.discover(
      "https://example.com/news",
      deps,
    );

    const appleUrls = items.filter((item) => item.url.includes("apple-q4"));
    expect(appleUrls).toHaveLength(1);
  });

  it("returns items with url only (no title)", async () => {
    const deps = buildDeps(LISTING_HTML);
    const items = await genericLinksStrategy.discover(
      "https://example.com/news",
      deps,
    );

    for (const item of items) {
      expect(item.title).toBeUndefined();
      expect(item.publishedAt).toBeUndefined();
    }
  });

  it("throws a classified error on HTTP failure", async () => {
    const networkError = new RequestError(
      "connection refused",
      { code: "ECONNREFUSED" },
      {} as never,
    );
    const deps = {
      gotClient: {
        get: vi.fn().mockRejectedValue(networkError),
      } as unknown as typeof got,
      rateLimiter: new RateLimiter(100, 1),
      logger: { info: vi.fn(), warn: vi.fn() },
    };

    await expect(
      genericLinksStrategy.discover("https://example.com/news", deps),
    ).rejects.toMatchObject({ errorCategory: "network_error" });
  });
});
