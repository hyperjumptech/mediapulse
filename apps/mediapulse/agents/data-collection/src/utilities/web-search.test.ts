/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { type SearchQuery, performWebSearch } from "./web-search";
import type { WebSearchConfig, SearchLocale } from "./config-schema";

/** A single Serper provider pool used by most cases. */
const defaultConfig: WebSearchConfig = [
  { provider: "serper", apiKey: "serper-key" },
];

const defaultLocales: SearchLocale[] = [{ gl: "id", hl: "id" }];

/** Builds a got POST response stub with HTTP status metadata. */
const mockGotPostResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
  json: vi.fn().mockResolvedValue(jsonValue),
});

describe("performWebSearch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when there are no queries", async () => {
    // Act
    const result = await performWebSearch([], {
      config: defaultConfig,
      locales: defaultLocales,
    });

    // Assert
    expect(result).toEqual([]);
  });

  it("calls Serper news with Indonesia defaults and maps the first result", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        news: [
          {
            link: "http://example.com",
            title: "Title",
            snippet: "Snippet",
          },
        ],
      }),
    );

    const fakeGot = { post: postMock } as unknown as typeof got;
    const queries: SearchQuery[] = [
      {
        id: "q1",
        text: "search",
        tickerId: "ticker-1",
        intent: "breaking",
        rank: 1,
      },
    ];

    // Act
    const result = await performWebSearch(queries, {
      config: defaultConfig,
      locales: defaultLocales,
      gotClient: fakeGot,
    });

    // Assert
    expect(postMock).toHaveBeenCalledWith(
      "https://google.serper.dev/news",
      expect.objectContaining({
        json: expect.objectContaining({
          q: "search",
          gl: "id",
          hl: "id",
          tbs: "qdr:w",
        }),
        headers: expect.objectContaining({
          "X-API-KEY": "serper-key",
        }),
      }),
    );
    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      success: true,
      data: {
        url: "http://example.com",
        title: "Title",
        content: "Snippet",
        tickerId: "ticker-1",
        searchQueryId: "q1",
        searchQueryText: "search",
        serpIndex: 0,
      },
    });
  });

  it("carries the provider-reported publish date through to the result", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        news: [
          {
            link: "http://example.com",
            title: "Title",
            snippet: "Snippet",
            date: "2026-05-20T00:00:00.000Z",
          },
        ],
      }),
    );

    const fakeGot = { post: postMock } as unknown as typeof got;
    const queries: SearchQuery[] = [
      {
        id: "q1",
        text: "search",
        tickerId: "ticker-1",
        intent: "breaking",
        rank: 1,
      },
    ];

    // Act
    const result = await performWebSearch(queries, {
      config: defaultConfig,
      locales: defaultLocales,
      gotClient: fakeGot,
    });

    // Assert
    expect(result[0]).toMatchObject({
      success: true,
      data: {
        url: "http://example.com",
        publishedAt: "2026-05-20T00:00:00.000Z",
      },
    });
  });

  it("returns failure when Serper returns invalid response shape", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        news: "not-an-array",
      }),
    );

    const fakeGot = { post: postMock } as unknown as typeof got;
    const queries: SearchQuery[] = [
      {
        id: "q1",
        text: "search",
        tickerId: "ticker-1",
        intent: "breaking",
        rank: 1,
      },
    ];

    // Act
    const result = await performWebSearch(queries, {
      config: defaultConfig,
      locales: defaultLocales,
      gotClient: fakeGot,
    });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      success: false,
      queryId: "q1",
      tickerId: "ticker-1",
    });
  });

  it("logs a warning when a query fails", async () => {
    // Setup
    const warnMock = vi.fn();
    const infoMock = vi.fn();
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        news: "not-an-array",
      }),
    );

    const fakeGot = { post: postMock } as unknown as typeof got;
    const queries: SearchQuery[] = [
      {
        id: "q1",
        text: "search",
        tickerId: "ticker-1",
        intent: "breaking",
        rank: 1,
      },
    ];

    // Act
    await performWebSearch(queries, {
      config: defaultConfig,
      locales: defaultLocales,
      gotClient: fakeGot,
      logger: { info: infoMock, warn: warnMock },
    });

    // Assert
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryId: "q1",
      }),
      "web search: all providers failed",
    );
  });
});
