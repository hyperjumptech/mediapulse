/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import type { WebSearchResult } from "./web-search";
import { performWebFetch } from "./web-fetch";

const defaultConfig = {
  baseUrl: "https://r.jina.ai/",
  authentication: {
    type: "bearer" as const,
    apiKey: "jina-key",
    headerName: "Authorization",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 4,
};

/** Builds a got POST response stub with HTTP status metadata. */
const mockGotPostResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  json: vi.fn().mockResolvedValue(jsonValue),
});

describe("performWebFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls Jina and returns enriched pages", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: {
          url: "http://example.com",
          title: "Title",
          content: "Full content",
        },
      }),
    );

    const fakeGot = { post: postMock } as unknown as typeof got;

    const searchResults: WebSearchResult[] = [
      {
        url: "http://example.com",
        title: "Snippet title",
        content: "Snippet",
        tickerId: "ticker-1",
        searchQueryId: "q1",
        searchQueryText: "query",
        serpIndex: 0,
      },
    ];

    // Act
    const result = await performWebFetch(searchResults, {
      config: defaultConfig,
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
      success: true,
      data: {
        url: "http://example.com",
        title: "Title",
        content: "Full content",
        tickerId: "ticker-1",
        searchQueryId: "q1",
        searchQueryText: "query",
      },
    });
  });

  it("returns failure when Jina returns invalid response shape", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: "not-an-object",
      }),
    );

    const fakeGot = { post: postMock } as unknown as typeof got;
    const searchResults: WebSearchResult[] = [
      {
        url: "http://example.com",
        title: "Snippet",
        content: "Snippet",
        tickerId: "ticker-1",
        searchQueryId: "q1",
        searchQueryText: "query",
        serpIndex: 0,
      },
    ];

    // Act
    const result = await performWebFetch(searchResults, {
      config: defaultConfig,
      gotClient: fakeGot,
    });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      success: false,
      url: "http://example.com",
      queryId: "q1",
      tickerId: "ticker-1",
      errorCategory: "provider_schema_error",
    });
  });

  it("logs a warning with a truncated URL when fetch fails and the URL is very long", async () => {
    // Setup
    const warnMock = vi.fn();
    const infoMock = vi.fn();
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: "not-an-object",
      }),
    );

    const fakeGot = { post: postMock } as unknown as typeof got;
    const longPath = "a".repeat(130);
    const longUrl = `https://example.com/${longPath}`;
    const searchResults: WebSearchResult[] = [
      {
        url: longUrl,
        title: "Snippet",
        content: "Snippet",
        tickerId: "ticker-1",
        searchQueryId: "q1",
        searchQueryText: "query",
        serpIndex: 0,
      },
    ];

    // Act
    await performWebFetch(searchResults, {
      config: defaultConfig,
      gotClient: fakeGot,
      logger: { info: infoMock, warn: warnMock },
    });

    // Assert
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchQueryId: "q1",
        url: `${longUrl.slice(0, 120)}…`,
        errorCategory: "provider_schema_error",
      }),
      "web fetch: URL failed",
    );
  });
});
