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
  it("flattens relations and previews content", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const content = "x".repeat(DATA_SOURCE_CONTENT_PREVIEW_MAX + 10);
    const row = {
      id: "ds-1",
      url: "https://example.com/a",
      title: "Article",
      content,
      metadata: null,
      tickerId: "t-1",
      searchQueryId: "sq-1",
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      searchQuery: { id: "sq-1", text: "earnings news" },
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
  });
});

describe("mapRowToDetailItem", () => {
  it("includes full content and metadata", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "ds-2",
      url: "https://example.com/b",
      title: "Full",
      content: "body text",
      metadata: { key: "v" },
      tickerId: "t-1",
      searchQueryId: "sq-1",
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      searchQuery: { id: "sq-1", text: "q" },
    } satisfies ListRow;

    const detail = mapRowToDetailItem(row);

    expect(detail.content).toBe("body text");
    expect(detail.metadata).toEqual({ key: "v" });
  });
});
