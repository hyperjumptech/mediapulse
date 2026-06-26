/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { mapRowToDetailItem, type DetailRow } from "./detail-mapper";

describe("mapRowToDetailItem", () => {
  it("includes full content, metadata, gate fields, and linked tickers", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "ds-2",
      url: "https://example.com/b",
      canonicalUrl: "https://example.com/b",
      title: "Full",
      content: "body text",
      author: null,
      source: null,
      metadata: { key: "v" },
      publishedAt: null,
      tickerId: null,
      searchQueryId: null,
      curatedSourceId: "cs-1",
      collectionGateStatus: "failed" as const,
      collectionGateReason: "Too short",
      analyzedAt: null,
      createdAt,
      updatedAt,
      ticker: null,
      searchQuery: null,
      curatedSource: {
        id: "cs-1",
        name: "News feed",
        listingUrl: "https://example.com/feed",
      },
      articleRelevances: [
        {
          id: "rel-1",
          score: 0.5,
          associationReasoning: "Weak match",
          ticker: { id: "t-1", symbol: "MSFT", name: "Microsoft" },
        },
      ],
    } satisfies DetailRow;

    const detail = mapRowToDetailItem(row);

    expect(detail.content).toBe("body text");
    expect(detail.metadata).toEqual({ key: "v" });
    expect(detail.collectionSource).toBe("page-collection");
    expect(detail.collectionGateStatusLabel).toBe("Failed");
    expect(detail.collectionGateReason).toBe("Too short");
    expect(detail.curatedSourceListingUrl).toBe("https://example.com/feed");
    expect(detail.articleRelevances[0]?.associationReasoning).toBe(
      "Weak match",
    );
  });

  it("emits data-collection for llm source", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "ds-3",
      url: "https://example.com/c",
      canonicalUrl: "https://example.com/c",
      title: "LLM",
      content: "body text",
      author: null,
      source: null,
      metadata: null,
      publishedAt: null,
      tickerId: "t-1",
      searchQueryId: "sq-3",
      curatedSourceId: null,
      collectionGateStatus: null,
      collectionGateReason: null,
      analyzedAt: null,
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      searchQuery: { id: "sq-3", text: "q", source: "llm" as const },
      curatedSource: null,
      articleRelevances: [],
    } satisfies DetailRow;

    const detail = mapRowToDetailItem(row);

    expect(detail.collectionSource).toBe("data-collection");
    expect(detail.collectionSourceLabel).toBe("Data Collection");
  });
});
