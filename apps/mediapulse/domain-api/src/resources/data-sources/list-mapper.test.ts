/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  DATA_SOURCE_CONTENT_PREVIEW_MAX,
  mapRowToListItem,
  truncateContentPreview,
  type ListRow,
} from "./list-mapper";

const baseRowFields = {
  canonicalUrl: "https://example.com/a",
  metadata: null,
  publishedAt: null,
  analyzedAt: null,
  curatedSourceId: null,
  collectionGateStatus: null,
  collectionGateReason: null,
  curatedSource: null,
  articleRelevances: [] as ListRow["articleRelevances"],
};

describe("truncateContentPreview", () => {
  it("returns the full string when within the max length", () => {
    expect(truncateContentPreview("hello", 200)).toBe("hello");
  });

  it("truncates with ellipsis when longer than max", () => {
    const long = "a".repeat(250);
    expect(truncateContentPreview(long, 200)).toBe(`${"a".repeat(200)}…`);
  });
});

describe("mapRowToListItem", () => {
  it("flattens relations, previews content, and emits collection source for curated", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const content = "x".repeat(DATA_SOURCE_CONTENT_PREVIEW_MAX + 10);
    const row = {
      id: "ds-1",
      url: "https://example.com/a",
      title: "Article",
      content,
      tickerId: "t-1",
      searchQueryId: "sq-1",
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      searchQuery: {
        id: "sq-1",
        text: "earnings news",
        source: "curated" as const,
      },
      ...baseRowFields,
    } satisfies ListRow;

    const item = mapRowToListItem(row);

    expect(item.id).toBe("ds-1");
    expect(item.tickerSymbol).toBe("ACME");
    expect(item.searchQueryText).toBe("earnings news");
    expect(item.contentLength).toBe(content.length);
    expect(item.contentPreview.endsWith("…")).toBe(true);
    expect(item.contentPreview.length).toBe(
      DATA_SOURCE_CONTENT_PREVIEW_MAX + 1,
    );
    expect(item.collectionSource).toBe("page-collection");
    expect(item.collectionSourceLabel).toBe("Page Collection");
    expect(item.collectionGateStatus).toBeNull();
    expect(item.articleRelevances).toEqual([]);
  });

  it("emits data-collection for deterministic source", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "ds-2",
      url: "https://example.com/b",
      title: "Article 2",
      content: "short",
      tickerId: "t-1",
      searchQueryId: "sq-2",
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      searchQuery: {
        id: "sq-2",
        text: "news",
        source: "deterministic" as const,
      },
      ...baseRowFields,
    } satisfies ListRow;

    const item = mapRowToListItem(row);

    expect(item.collectionSource).toBe("data-collection");
    expect(item.collectionSourceLabel).toBe("Data Collection");
  });

  it("maps global page-collection gate fields and article relevances", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "ds-global",
      url: "https://example.com/global",
      title: "Global article",
      content: "body",
      tickerId: null,
      searchQueryId: null,
      createdAt,
      updatedAt,
      ticker: null,
      searchQuery: null,
      curatedSourceId: "cs-1",
      collectionGateStatus: "passed" as const,
      collectionGateReason: null,
      analyzedAt: null,
      curatedSource: {
        id: "cs-1",
        name: "Tech feed",
        listingUrl: "https://example.com/feed",
      },
      articleRelevances: [
        {
          id: "rel-1",
          score: 0.91,
          associationReasoning: "Mentions AAPL earnings.",
          ticker: { id: "t-1", symbol: "AAPL", name: "Apple Inc." },
        },
      ],
      canonicalUrl: "https://example.com/global",
      metadata: null,
      publishedAt: null,
    } satisfies ListRow;

    const item = mapRowToListItem(row);

    expect(item.collectionSource).toBe("page-collection");
    expect(item.collectionGateStatusLabel).toBe("Passed");
    expect(item.curatedSource?.listingUrl).toBe("https://example.com/feed");
    expect(item.articleRelevances).toEqual([
      {
        id: "rel-1",
        tickerId: "t-1",
        tickerSymbol: "AAPL",
        tickerName: "Apple Inc.",
        score: 0.91,
        associationReasoning: "Mentions AAPL earnings.",
      },
    ]);
  });
});
