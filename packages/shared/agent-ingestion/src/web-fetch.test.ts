/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import type { WebSearchResult } from "./web-fetch";
import { performWebFetch } from "./web-fetch";

const jinaProviderConfig = {
  type: "jina" as const,
  baseUrl: "https://r.jina.ai/",
  authentication: {
    type: "bearer" as const,
    apiKey: "jina-key",
    headerName: "Authorization",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 4,
};

const firecrawlProviderConfig = {
  type: "firecrawl" as const,
  baseUrl: "https://api.firecrawl.dev",
  authentication: {
    type: "bearer" as const,
    apiKey: "fc-key",
    headerName: "Authorization",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 4,
};

const diffbotProviderConfig = {
  type: "diffbot" as const,
  baseUrl: "https://api.diffbot.com",
  authentication: {
    type: "none" as const,
    apiKey: "diffbot-token",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 4,
};

/** Builds a got POST response stub with HTTP status metadata. */
const mockGotPostResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
});

/** Builds a got GET response stub with HTTP status metadata. */
const mockGotGetResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
});

const baseSearchResult: WebSearchResult = {
  url: "http://example.com",
  title: "Snippet title",
  content: "Snippet",
  tickerId: "ticker-1",
  searchQueryId: "q1",
  searchQueryText: "query",
  serpIndex: 0,
};

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

    // Act
    const result = await performWebFetch([baseSearchResult], {
      config: { providers: [jinaProviderConfig] },
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
    expect(result[0]?.success).toMatchObject({
      url: "http://example.com",
      title: "Title",
      content: "Full content",
      tickerId: "ticker-1",
      searchQueryId: "q1",
      searchQueryText: "query",
      provider: "jina",
    });
    expect(result[0]?.failures).toEqual([]);
  });

  it("returns failures when Jina returns invalid response shape", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: "not-an-object",
      }),
    );
    const fakeGot = { post: postMock } as unknown as typeof got;

    // Act
    const result = await performWebFetch([baseSearchResult], {
      config: { providers: [jinaProviderConfig] },
      gotClient: fakeGot,
    });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.success).toBeNull();
    expect(result[0]?.failures).toEqual([
      expect.objectContaining({
        url: "http://example.com",
        queryId: "q1",
        tickerId: "ticker-1",
        provider: "jina",
        errorCategory: "provider_schema_error",
      }),
    ]);
  });

  it("falls back to the next provider when the primary provider fails", async () => {
    // Setup
    const postMock = vi
      .fn()
      .mockReturnValueOnce(
        mockGotPostResponse({
          data: "not-an-object",
        }),
      )
      .mockReturnValueOnce(
        mockGotPostResponse({
          success: true,
          data: {
            markdown: "Firecrawl body",
            metadata: { title: "Firecrawl title" },
          },
        }),
      );
    const fakeGot = { post: postMock } as unknown as typeof got;

    // Act
    const result = await performWebFetch([baseSearchResult], {
      config: { providers: [jinaProviderConfig, firecrawlProviderConfig] },
      gotClient: fakeGot,
    });

    // Assert
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(result[0]?.success).toMatchObject({
      provider: "firecrawl",
      title: "Firecrawl title",
      content: "Firecrawl body",
    });
    expect(result[0]?.failures).toEqual([
      expect.objectContaining({ provider: "jina" }),
    ]);
  });

  it("records one failure per provider when the entire chain fails", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: "not-an-object",
      }),
    );
    const getMock = vi.fn().mockReturnValue(
      mockGotGetResponse({
        objects: [],
      }),
    );
    const fakeGot = {
      post: postMock,
      get: getMock,
    } as unknown as typeof got;

    // Act
    const result = await performWebFetch([baseSearchResult], {
      config: {
        providers: [
          jinaProviderConfig,
          firecrawlProviderConfig,
          diffbotProviderConfig,
        ],
      },
      gotClient: fakeGot,
    });

    // Assert
    expect(result[0]?.success).toBeNull();
    expect(result[0]?.failures).toHaveLength(3);
    expect(result[0]?.failures.map((failure) => failure.provider)).toEqual([
      "jina",
      "firecrawl",
      "diffbot",
    ]);
  });

  it("short-circuits remaining providers after the first success", async () => {
    // Setup
    const postMock = vi
      .fn()
      .mockReturnValueOnce(
        mockGotPostResponse({
          data: {
            url: "http://example.com",
            title: "Title",
            content: "Full content",
          },
        }),
      )
      .mockReturnValue(
        mockGotPostResponse({
          success: true,
          data: { markdown: "Should not be used" },
        }),
      );
    const getMock = vi.fn();
    const fakeGot = {
      post: postMock,
      get: getMock,
    } as unknown as typeof got;

    // Act
    await performWebFetch([baseSearchResult], {
      config: {
        providers: [
          jinaProviderConfig,
          firecrawlProviderConfig,
          diffbotProviderConfig,
        ],
      },
      gotClient: fakeGot,
    });

    // Assert
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("uses separate rate limiters per provider", async () => {
    // Setup
    const acquireCounts = { jina: 0, firecrawl: 0 };
    const postMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("jina.ai")) {
        acquireCounts.jina += 1;
        return mockGotPostResponse({ data: "not-an-object" });
      }
      acquireCounts.firecrawl += 1;
      return mockGotPostResponse({
        success: true,
        data: { markdown: "Recovered" },
      });
    });
    const fakeGot = { post: postMock } as unknown as typeof got;

    // Act
    await performWebFetch([baseSearchResult, baseSearchResult], {
      config: {
        providers: [
          { ...jinaProviderConfig, rateLimit: { requests: 1, perSeconds: 1 } },
          {
            ...firecrawlProviderConfig,
            rateLimit: { requests: 1, perSeconds: 1 },
          },
        ],
      },
      gotClient: fakeGot,
    });

    // Assert — both providers were invoked once per URL through their own limiters
    expect(acquireCounts.jina).toBe(2);
    expect(acquireCounts.firecrawl).toBe(2);
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

    // Act
    await performWebFetch([{ ...baseSearchResult, url: longUrl }], {
      config: { providers: [jinaProviderConfig] },
      gotClient: fakeGot,
      logger: { info: infoMock, warn: warnMock },
    });

    // Assert
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        searchQueryId: "q1",
        url: `${longUrl.slice(0, 120)}…`,
        provider: "jina",
        errorCategory: "provider_schema_error",
      }),
      "web fetch: provider failed",
    );
  });
});
