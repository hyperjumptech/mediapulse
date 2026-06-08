/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

import {
  lookupListingDiscoveryCache,
  recordListingDiscoveryCache,
} from "./listing-discovery-cache";

const ITEMS = [
  { url: "https://example.com/a", title: "Article A" },
  { url: "https://example.com/b" },
];

describe("lookupListingDiscoveryCache", () => {
  it("returns non-expired entries for the requested listing URLs", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { listingUrl: "https://example.com/feed", items: ITEMS },
      ]);

    const result = await lookupListingDiscoveryCache(
      ["https://example.com/feed", "https://example.com/other"],
      {
        listingDiscoveryCache: { findMany, upsert: vi.fn() },
        now,
      },
    );

    expect(result).toEqual([
      { listingUrl: "https://example.com/feed", items: ITEMS },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        listingUrl: {
          in: ["https://example.com/feed", "https://example.com/other"],
        },
        expiresAt: { gt: now },
      },
      select: { listingUrl: true, items: true },
    });
  });

  it("returns empty array when no listing URLs are provided", async () => {
    const findMany = vi.fn();

    const result = await lookupListingDiscoveryCache([], {
      listingDiscoveryCache: { findMany, upsert: vi.fn() },
    });

    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("excludes expired entries (Prisma filter is passed correctly)", async () => {
    const now = new Date("2026-06-08T00:00:00.000Z");
    const findMany = vi.fn().mockResolvedValue([]);

    await lookupListingDiscoveryCache(["https://example.com/feed"], {
      listingDiscoveryCache: { findMany, upsert: vi.fn() },
      now,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: { gt: now },
        }),
      }),
    );
  });
});

describe("recordListingDiscoveryCache", () => {
  it("upserts each entry with correct expiresAt based on ttlSeconds", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const upsert = vi.fn().mockResolvedValue({});

    const recorded = await recordListingDiscoveryCache(
      [
        {
          listingUrl: "https://example.com/feed",
          strategy: "rss",
          items: ITEMS,
          ttlSeconds: 3600,
        },
      ],
      {
        listingDiscoveryCache: { findMany: vi.fn(), upsert },
        now,
      },
    );

    expect(recorded).toBe(1);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith({
      where: { listingUrl: "https://example.com/feed" },
      create: expect.objectContaining({
        listingUrl: "https://example.com/feed",
        strategy: "rss",
        items: ITEMS,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 3600 * 1000),
      }),
      update: expect.objectContaining({
        strategy: "rss",
        items: ITEMS,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + 3600 * 1000),
      }),
    });
  });

  it("upserts multiple records and returns the count", async () => {
    const upsert = vi.fn().mockResolvedValue({});

    const recorded = await recordListingDiscoveryCache(
      [
        {
          listingUrl: "https://example.com/feed-1",
          strategy: "rss",
          items: ITEMS,
          ttlSeconds: 3600,
        },
        {
          listingUrl: "https://example.com/feed-2",
          strategy: "sitemap",
          items: [],
          ttlSeconds: 1800,
        },
      ],
      {
        listingDiscoveryCache: { findMany: vi.fn(), upsert },
      },
    );

    expect(recorded).toBe(2);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when no records are provided", async () => {
    const upsert = vi.fn();

    const recorded = await recordListingDiscoveryCache([], {
      listingDiscoveryCache: { findMany: vi.fn(), upsert },
    });

    expect(recorded).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});
