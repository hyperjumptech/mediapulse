import { describe, it, expect, vi, beforeEach } from "vitest";
import type got from "got";

import { discoverOneSource, runDiscovery } from "./run-discovery";
import { rssStrategy } from "./rss";
import { sitemapStrategy } from "./sitemap";
import { genericLinksStrategy } from "./generic-links";
import { RateLimiter } from "../resilience";

vi.mock("./rss", () => ({
  rssStrategy: { type: "rss", discover: vi.fn() },
}));

vi.mock("./sitemap", () => ({
  sitemapStrategy: { type: "sitemap", discover: vi.fn() },
}));

vi.mock("./generic-links", () => ({
  genericLinksStrategy: { type: "generic-links", discover: vi.fn() },
}));

const buildDeps = () => ({
  gotClient: {} as typeof got,
  rateLimiter: new RateLimiter(100, 1),
  logger: { info: vi.fn(), warn: vi.fn() },
});

const RSS_ERROR = Object.assign(new Error("feed not found"), {
  errorCategory: "provider_http_error",
});

describe("discoverOneSource", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns items from the first strategy that succeeds with non-empty results", async () => {
    const rssItems = [{ url: "https://example.com/a" }];
    vi.mocked(rssStrategy.discover).mockResolvedValue(rssItems);

    const result = await discoverOneSource(
      {
        url: "https://example.com/feed",
        strategies: ["rss", "sitemap", "generic-links"],
      },
      buildDeps(),
    );

    expect(result.items).toEqual(rssItems);
    expect(result.failures).toHaveLength(0);
    expect(vi.mocked(sitemapStrategy.discover)).not.toHaveBeenCalled();
  });

  it("falls through rss error → sitemap empty → generic-links succeeds", async () => {
    const genericItems = [{ url: "https://example.com/article/one" }];
    vi.mocked(rssStrategy.discover).mockRejectedValue(RSS_ERROR);
    vi.mocked(sitemapStrategy.discover).mockResolvedValue([]);
    vi.mocked(genericLinksStrategy.discover).mockResolvedValue(genericItems);

    const result = await discoverOneSource(
      {
        url: "https://example.com/news",
        strategies: ["rss", "sitemap", "generic-links"],
      },
      buildDeps(),
    );

    expect(result.items).toEqual(genericItems);
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0]?.strategyType).toBe("rss");
    expect(result.failures[1]?.strategyType).toBe("sitemap");
  });

  it("returns empty items and all failures when the whole chain is exhausted", async () => {
    vi.mocked(rssStrategy.discover).mockRejectedValue(RSS_ERROR);
    vi.mocked(sitemapStrategy.discover).mockRejectedValue(
      new Error("sitemap gone"),
    );
    vi.mocked(genericLinksStrategy.discover).mockRejectedValue(
      new Error("403"),
    );

    const result = await discoverOneSource(
      {
        url: "https://example.com/news",
        strategies: ["rss", "sitemap", "generic-links"],
      },
      buildDeps(),
    );

    expect(result.items).toHaveLength(0);
    expect(result.failures).toHaveLength(3);
  });

  it("respects maxItems when the winning strategy returns too many", async () => {
    const manyItems = Array.from({ length: 20 }, (_, index) => ({
      url: `https://example.com/articles/${index}`,
    }));
    vi.mocked(rssStrategy.discover).mockResolvedValue(manyItems);

    const result = await discoverOneSource(
      { url: "https://example.com/feed", strategies: ["rss"], maxItems: 5 },
      buildDeps(),
    );

    expect(result.items).toHaveLength(5);
  });
});

describe("runDiscovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("skips sources with enabled: false", async () => {
    vi.mocked(rssStrategy.discover).mockResolvedValue([
      { url: "https://a.com/article" },
    ]);

    const result = await runDiscovery(
      [
        { url: "https://a.com/feed", strategies: ["rss"] },
        { url: "https://b.com/feed", strategies: ["rss"], enabled: false },
      ],
      buildDeps(),
    );

    expect(vi.mocked(rssStrategy.discover)).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
  });

  it("deduplicates items with the same URL across sources", async () => {
    const sharedItem = { url: "https://example.com/shared-article" };
    vi.mocked(rssStrategy.discover).mockResolvedValue([sharedItem]);
    vi.mocked(sitemapStrategy.discover).mockResolvedValue([sharedItem]);

    const result = await runDiscovery(
      [
        { url: "https://example.com/feed.rss", strategies: ["rss"] },
        { url: "https://example.com/sitemap.xml", strategies: ["sitemap"] },
      ],
      buildDeps(),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.url).toBe("https://example.com/shared-article");
  });

  it("never throws even when all sources fail; captures failures", async () => {
    vi.mocked(rssStrategy.discover).mockRejectedValue(RSS_ERROR);

    const result = await runDiscovery(
      [{ url: "https://example.com/feed", strategies: ["rss"] }],
      buildDeps(),
    );

    expect(result.items).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
  });
});
