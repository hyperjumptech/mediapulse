/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  DATA_SOURCE_CONTENT_PREVIEW_MAX,
  mapRowToDetailItem,
  mapRowToListItem,
  truncateContentPreview,
  type ListRow,
} from "./list-mapper";

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
      canonicalUrl: "https://example.com/a",
      title: "Article",
      content,
      metadata: null,
      publishedAt: null,
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
  });

  it("emits data-collection for deterministic source", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "ds-2",
      url: "https://example.com/b",
      canonicalUrl: "https://example.com/b",
      title: "Article 2",
      content: "short",
      metadata: null,
      publishedAt: null,
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
    } satisfies ListRow;

    const item = mapRowToListItem(row);

    expect(item.collectionSource).toBe("data-collection");
    expect(item.collectionSourceLabel).toBe("Data Collection");
  });
});

describe("mapRowToDetailItem", () => {
  it("includes full content, metadata, and collection source for curated", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "ds-2",
      url: "https://example.com/b",
      canonicalUrl: "https://example.com/b",
      title: "Full",
      content: "body text",
      metadata: { key: "v" },
      publishedAt: null,
      tickerId: "t-1",
      searchQueryId: "sq-1",
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      searchQuery: { id: "sq-1", text: "q", source: "curated" as const },
    } satisfies ListRow;

    const detail = mapRowToDetailItem(row);

    expect(detail.content).toBe("body text");
    expect(detail.metadata).toEqual({ key: "v" });
    expect(detail.collectionSource).toBe("page-collection");
    expect(detail.collectionSourceLabel).toBe("Page Collection");
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
      metadata: null,
      publishedAt: null,
      tickerId: "t-1",
      searchQueryId: "sq-3",
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      searchQuery: { id: "sq-3", text: "q", source: "llm" as const },
    } satisfies ListRow;

    const detail = mapRowToDetailItem(row);

    expect(detail.collectionSource).toBe("data-collection");
    expect(detail.collectionSourceLabel).toBe("Data Collection");
  });
});
