import { afterEach, describe, expect, it, vi } from "vitest";

import { performWebFetch } from "../src/utilities/web-fetch.js";

describe("performWebFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Jina and returns enriched pages", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({
        data: {
          url: "http://example.com",
          title: "Title",
          content: "Full content",
        },
      }),
    });

    const fakeGot = { post: postMock } as any;

    const searchResults = [
      {
        url: "http://example.com",
        title: "Snippet title",
        content: "Snippet",
        tickerId: "ticker-1",
        searchQueryId: "q1",
        searchQueryText: "query",
      },
    ];

    // Act
    const result = await performWebFetch(searchResults, {
      jinaApiKey: "jina-key",
      gotClient: fakeGot,
    });

    // Assert
    expect(postMock).toHaveBeenCalledWith(
      "https://r.jina.ai/",
      expect.objectContaining({
        json: { url: "http://example.com" },
        headers: expect.objectContaining({
          Authorization: "Bearer jina-key",
        }),
      }),
    );
    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      url: "http://example.com",
      title: "Title",
      content: "Full content",
      tickerId: "ticker-1",
      searchQueryId: "q1",
      searchQueryText: "query",
    });
  });
});
