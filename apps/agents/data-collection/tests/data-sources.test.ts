import { describe, expect, it } from "vitest";

import { toDataSources } from "../src/utilities/data-sources.js";

describe("toDataSources", () => {
  it("maps collected pages to DataCollectionInput with metadata", () => {
    // Setup
    const pages = [
      {
        url: "http://example.com",
        title: "Title",
        content: "Content",
        tickerId: "ticker-1",
        searchQueryId: "q1",
        searchQueryText: "query",
      },
    ] as any;

    const fixedDate = new Date("2024-01-01T00:00:00.000Z");

    // Act
    const result = toDataSources("ticker-1", pages, () => fixedDate);

    // Assert
    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      url: "http://example.com",
      title: "Title",
      content: "Content",
      tickerId: "ticker-1",
      searchQueryId: "q1",
      metadata: {
        searchQueryText: "query",
        fetchedAt: fixedDate.toISOString(),
        sourceType: "web",
      },
    });
  });
});
