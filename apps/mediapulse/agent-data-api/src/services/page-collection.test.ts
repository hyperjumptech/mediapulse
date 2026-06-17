/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

import { resolveCuratedSourcesByListingUrls } from "./page-collection";

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
