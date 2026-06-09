import { describe, it, expect, vi, beforeEach } from "vitest";
import type got from "got";

import {
  discoverOneSource,
  runDiscovery,
  type DiscoveryCache,
} from "./run-discovery";
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

  it("returns items when the chosen strategy succeeds with non-empty results", async () => {
    const rssItems = [{ url: "https://example.com/a" }];
    vi.mocked(rssStrategy.discover).mockResolvedValue(rssItems);

    const result = await discoverOneSource(
      { url: "https://example.com/feed", strategy: "rss" },
      buildDeps(),
    );

    expect(result.items).toEqual(rssItems);
    expect(result.failures).toHaveLength(0);
    expect(result.winningStrategy).toBe("rss");
    expect(vi.mocked(sitemapStrategy.discover)).not.toHaveBeenCalled();
    expect(vi.mocked(genericLinksStrategy.discover)).not.toHaveBeenCalled();
  });

  it("returns empty items and a failure when the strategy returns no items", async () => {
    vi.mocked(rssStrategy.discover).mockResolvedValue([]);

    const result = await discoverOneSource(
      { url: "https://example.com/feed", strategy: "rss" },
      buildDeps(),
    );

    expect(result.items).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.strategyType).toBe("rss");
    expect(result.failures[0]?.errorCategory).toBe("provider_data_invalid");
    expect(result.winningStrategy).toBeNull();
  });

  it("returns empty items and a failure when the strategy throws", async () => {
    vi.mocked(rssStrategy.discover).mockRejectedValue(RSS_ERROR);

    const result = await discoverOneSource(
      { url: "https://example.com/feed", strategy: "rss" },
      buildDeps(),
    );

    expect(result.items).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.strategyType).toBe("rss");
    expect(result.winningStrategy).toBeNull();
  });

  it("runs the sitemap strategy when strategy is sitemap", async () => {
    const sitemapItems = [{ url: "https://example.com/sitemap-article" }];
    vi.mocked(sitemapStrategy.discover).mockResolvedValue(sitemapItems);

    const result = await discoverOneSource(
      { url: "https://example.com/sitemap.xml", strategy: "sitemap" },
      buildDeps(),
    );

    expect(result.items).toEqual(sitemapItems);
    expect(result.winningStrategy).toBe("sitemap");
    expect(vi.mocked(rssStrategy.discover)).not.toHaveBeenCalled();
  });

  it("runs the generic-links strategy when strategy is generic-links", async () => {
    const genericItems = [{ url: "https://example.com/article/one" }];
    vi.mocked(genericLinksStrategy.discover).mockResolvedValue(genericItems);

    const result = await discoverOneSource(
      { url: "https://example.com/news", strategy: "generic-links" },
      buildDeps(),
    );

    expect(result.items).toEqual(genericItems);
    expect(result.winningStrategy).toBe("generic-links");
    expect(vi.mocked(rssStrategy.discover)).not.toHaveBeenCalled();
  });

  it("respects maxItems when the strategy returns too many", async () => {
    const manyItems = Array.from({ length: 20 }, (_, index) => ({
      url: `https://example.com/articles/${index}`,
    }));
    vi.mocked(rssStrategy.discover).mockResolvedValue(manyItems);

    const result = await discoverOneSource(
      { url: "https://example.com/feed", strategy: "rss", maxItems: 5 },
      buildDeps(),
    );

    expect(result.items).toHaveLength(5);
  });

  it("does not fall through to other strategies when the chosen one fails", async () => {
    vi.mocked(rssStrategy.discover).mockRejectedValue(RSS_ERROR);

    await discoverOneSource(
      { url: "https://example.com/feed", strategy: "rss" },
      buildDeps(),
    );

    expect(vi.mocked(sitemapStrategy.discover)).not.toHaveBeenCalled();
    expect(vi.mocked(genericLinksStrategy.discover)).not.toHaveBeenCalled();
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
        { url: "https://a.com/feed", strategy: "rss" },
        { url: "https://b.com/feed", strategy: "rss", enabled: false },
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
        { url: "https://example.com/feed.rss", strategy: "rss" },
        { url: "https://example.com/sitemap.xml", strategy: "sitemap" },
      ],
      buildDeps(),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.url).toBe("https://example.com/shared-article");
  });

  it("never throws even when all sources fail; captures failures", async () => {
    vi.mocked(rssStrategy.discover).mockRejectedValue(RSS_ERROR);

    const result = await runDiscovery(
      [{ url: "https://example.com/feed", strategy: "rss" }],
      buildDeps(),
    );

    expect(result.items).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
  });
});

describe("runDiscovery with cache", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const buildCache = (
    overrides: Partial<DiscoveryCache> = {},
  ): DiscoveryCache => ({
    ttlSeconds: 3600,
    lookup: vi.fn().mockResolvedValue([]),
    record: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it("returns cached items and skips live scrape on a cache hit", async () => {
    const cachedItems = [{ url: "https://example.com/cached-article" }];
    const cache = buildCache({
      lookup: vi
        .fn()
        .mockResolvedValue([
          { listingUrl: "https://example.com/feed", items: cachedItems },
        ]),
    });

    const result = await runDiscovery(
      [{ url: "https://example.com/feed", strategy: "rss" }],
      buildDeps(),
      cache,
    );

    expect(result.items).toEqual(cachedItems);
    expect(vi.mocked(rssStrategy.discover)).not.toHaveBeenCalled();
    expect(cache.record).not.toHaveBeenCalled();
  });

  it("scrapes once on a miss and records the result", async () => {
    const liveItems = [{ url: "https://example.com/live-article" }];
    vi.mocked(rssStrategy.discover).mockResolvedValue(liveItems);
    const cache = buildCache();

    const result = await runDiscovery(
      [{ url: "https://example.com/feed", strategy: "rss" }],
      buildDeps(),
      cache,
    );

    expect(result.items).toEqual(liveItems);
    expect(vi.mocked(rssStrategy.discover)).toHaveBeenCalledOnce();
    expect(cache.record).toHaveBeenCalledOnce();
    expect(vi.mocked(cache.record)).toHaveBeenCalledWith([
      expect.objectContaining({
        listingUrl: "https://example.com/feed",
        strategy: "rss",
        items: liveItems,
        ttlSeconds: 3600,
      }),
    ]);
  });

  it("does not record an empty discovery result", async () => {
    vi.mocked(rssStrategy.discover).mockResolvedValue([]);
    const cache = buildCache();

    await runDiscovery(
      [{ url: "https://example.com/feed", strategy: "rss" }],
      buildDeps(),
      cache,
    );

    expect(cache.record).not.toHaveBeenCalled();
  });

  it("a second call for the same source performs zero live scrapes", async () => {
    let scrapeCount = 0;
    vi.mocked(rssStrategy.discover).mockImplementation(async () => {
      scrapeCount += 1;
      return [{ url: "https://example.com/article" }];
    });

    const cacheStore = new Map<string, Array<{ url: string }>>();
    const cache: DiscoveryCache = {
      ttlSeconds: 3600,
      lookup: async (listingUrls) =>
        listingUrls
          .filter((url) => cacheStore.has(url))
          .map((url) => ({ listingUrl: url, items: cacheStore.get(url)! })),
      record: async (entries) => {
        for (const entry of entries) {
          cacheStore.set(
            entry.listingUrl,
            entry.items as Array<{ url: string }>,
          );
        }
      },
    };

    const source = [
      { url: "https://example.com/feed", strategy: "rss" as const },
    ];
    const deps = buildDeps();

    await runDiscovery(source, deps, cache);
    await runDiscovery(source, deps, cache);

    expect(scrapeCount).toBe(1);
  });

  it("falls back to live scrape when no cache is provided", async () => {
    const liveItems = [{ url: "https://example.com/live-article" }];
    vi.mocked(rssStrategy.discover).mockResolvedValue(liveItems);

    const result = await runDiscovery(
      [{ url: "https://example.com/feed", strategy: "rss" }],
      buildDeps(),
    );

    expect(result.items).toEqual(liveItems);
  });
});
