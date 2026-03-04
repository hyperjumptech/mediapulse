import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type WebSearchDeps,
  performWebSearch,
} from "../src/utilities/web-search.js";

describe("performWebSearch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when there are no queries", async () => {
    // Act
    const result = await performWebSearch([], {
      serperApiKey: "key",
    } as WebSearchDeps);

    // Assert
    expect(result).toEqual([]);
  });

  it("calls Serper and maps the first organic result", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({
        organic: [
          {
            link: "http://example.com",
            title: "Title",
            snippet: "Snippet",
          },
        ],
      }),
    });

    const fakeGot = { post: postMock } as any;
    const queries = [{ id: "q1", text: "search", tickerId: "ticker-1" }] as any;

    // Act
    const result = await performWebSearch(queries, {
      serperApiKey: "serper-key",
      gotClient: fakeGot,
    });

    // Assert
    expect(postMock).toHaveBeenCalledWith(
      "https://google.serper.dev/search",
      expect.objectContaining({
        json: { q: "search" },
        headers: expect.objectContaining({
          "X-API-KEY": "serper-key",
        }),
      }),
    );
    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      url: "http://example.com",
      title: "Title",
      content: "Snippet",
      tickerId: "ticker-1",
      searchQueryId: "q1",
      searchQueryText: "search",
    });
  });
});
