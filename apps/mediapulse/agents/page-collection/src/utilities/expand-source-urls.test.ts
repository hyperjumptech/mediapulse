import { beforeEach, describe, expect, it, vi } from "vitest";

const discoverMock = vi.fn();

vi.mock("@workspace/agent-ingestion", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@workspace/agent-ingestion")>();
  return {
    ...actual,
    createListingDiscoveryStrategy: vi.fn(() => ({
      discover: discoverMock,
    })),
  };
});

import { createListingDiscoveryStrategy } from "@workspace/agent-ingestion";

import {
  expandSourceUrl,
  looksLikeFeedUrl,
  looksLikeSitemapUrl,
} from "./expand-source-urls";

const discoveryDeps = {
  gotClient: {
    get: async () => ({ body: "", statusCode: 200 }),
  } as never,
  rateLimiter: { acquire: async () => {} } as never,
  logger: { info: () => {}, warn: () => {}, error: () => {} } as never,
  timeoutMs: 5000,
  concurrency: 1,
};

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
  beforeEach(() => {
    vi.clearAllMocks();
    discoverMock.mockResolvedValue([]);
  });

  it("returns the URL itself for a page-type source", async () => {
    const url = "https://example.com/article/one";
    const items = await expandSourceUrl(url, discoveryDeps, {
      linkType: "page",
    });

    expect(items).toEqual([{ url }]);
    expect(createListingDiscoveryStrategy).not.toHaveBeenCalled();
  });

  it("returns the URL itself for a regular web page without linkType", async () => {
    const url = "https://example.com/article/one";
    const items = await expandSourceUrl(url, discoveryDeps);

    expect(items).toEqual([{ url }]);
    expect(createListingDiscoveryStrategy).not.toHaveBeenCalled();
  });

  it("uses generic-links for listing-type HTML pages", async () => {
    discoverMock.mockResolvedValue([
      { url: "https://example.com/news/a" },
      { url: "https://example.com/news/b" },
    ]);

    const listingUrl = "https://example.com/news";
    const items = await expandSourceUrl(listingUrl, discoveryDeps, {
      linkType: "listing",
    });

    expect(createListingDiscoveryStrategy).toHaveBeenCalledWith(
      "generic-links",
    );
    expect(items).toEqual([
      { url: "https://example.com/news/a" },
      { url: "https://example.com/news/b" },
    ]);
  });

  it("prefers RSS discovery for listing-type feed URLs", async () => {
    discoverMock.mockResolvedValue([{ url: "https://example.com/post-1" }]);

    const feedUrl = "https://example.com/feed";
    const items = await expandSourceUrl(feedUrl, discoveryDeps, {
      linkType: "listing",
    });

    expect(createListingDiscoveryStrategy).toHaveBeenCalledWith("rss");
    expect(items).toEqual([{ url: "https://example.com/post-1" }]);
  });
});
