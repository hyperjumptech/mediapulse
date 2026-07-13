/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

import {
  persistPageCollectionArticles,
  resolveCuratedSourcesByListingUrls,
} from "./page-collection";

describe("resolveCuratedSourcesByListingUrls", () => {
  it("returns linkType with resolved curated sources", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "11111111-1111-4111-a111-111111111111",
        listingUrl: "https://example.com/news",
        linkType: "listing",
        maxItems: 10,
      },
      {
        id: "22222222-2222-4222-a222-222222222222",
        listingUrl: "https://example.com/article/one",
        linkType: "page",
        maxItems: null,
      },
    ]);

    const result = await resolveCuratedSourcesByListingUrls(
      {
        listingUrls: [
          "https://example.com/news",
          "https://example.com/article/one",
        ],
      },
      { db: { findMany } },
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        listingUrl: {
          in: ["https://example.com/news", "https://example.com/article/one"],
        },
        enabled: true,
      },
      select: {
        id: true,
        listingUrl: true,
        linkType: true,
        maxItems: true,
      },
    });
    expect(result).toEqual({
      sources: [
        {
          listingUrl: "https://example.com/news",
          curatedSourceId: "11111111-1111-4111-a111-111111111111",
          linkType: "listing",
          maxItems: 10,
        },
        {
          listingUrl: "https://example.com/article/one",
          curatedSourceId: "22222222-2222-4222-a222-222222222222",
          linkType: "page",
          maxItems: null,
        },
      ],
    });
  });
});

describe("persistPageCollectionArticles", () => {
  it("inserts rows idempotently via dataSource.create", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: "ds-1" })
      .mockResolvedValueOnce({ id: "ds-2" });
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "curated-1",
        listingUrl: "https://example.com/news",
      },
    ]);

    const count = await persistPageCollectionArticles(
      [
        {
          url: "https://example.com/article/1",
          title: "One",
          description: "Feed description one",
          curatedSourceListingUrl: "https://example.com/news",
          collectionGateStatus: "passed",
        },
        {
          url: "https://example.com/article/2",
          title: "Two",
          description: "Feed description two",
          curatedSourceListingUrl: "https://example.com/news",
          collectionGateStatus: "passed",
        },
      ],
      { db: { curatedSource: { findMany }, dataSource: { create } } },
    );

    expect(count).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]?.data).toMatchObject({
      canonicalUrl: "https://example.com/article/1",
      curatedSourceId: "curated-1",
      tickerId: null,
      searchQueryId: null,
      description: "Feed description one",
      content: null,
      collectionGateStatus: "passed",
    });
  });

  it("returns zero for an empty payload", async () => {
    const create = vi.fn();

    const count = await persistPageCollectionArticles([], {
      db: { curatedSource: { findMany: vi.fn() }, dataSource: { create } },
    });

    expect(count).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
});
