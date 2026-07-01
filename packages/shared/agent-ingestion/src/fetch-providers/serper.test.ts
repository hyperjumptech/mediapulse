/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";
import { HTTPError } from "got";

import { createSerperFetchProvider } from "./serper";
import type { FetchProviderConfig } from "./types";
import { mockRateLimiter } from "./test-fixtures";

const defaultConfig: FetchProviderConfig = {
  type: "serper",
  baseUrl: "https://scrape.serper.dev",
  authentication: {
    type: "none",
    apiKey: "serper-key",
    headerName: "X-API-KEY",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 4,
};

/** Builds a got POST response stub with HTTP status metadata. */
const mockGotPostResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
});

/** Builds a minimal got {@link HTTPError} exposing status and headers. */
const createTestHttpError = (
  statusCode: number,
  headers: Record<string, string> = {},
): HTTPError => {
  const plainResponse: Record<string, unknown> = {
    statusCode,
    statusMessage: "Error",
    headers,
    requestUrl: new URL("http://example.test"),
    redirectUrls: [],
    isFromCache: false,
    url: "http://example.test",
    timings: {},
    retryCount: 0,
    ok: false,
  };
  plainResponse.request = {
    _onResponse: () => {
      /* noop — satisfies Got's request probe */
    },
    options: { method: "GET", url: new URL("http://example.test") },
    response: plainResponse,
  };

  return new HTTPError(
    plainResponse as unknown as ConstructorParameters<typeof HTTPError>[0],
  );
};

describe("createSerperFetchProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses and normalizes a successful Serper response", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        text: "Article body",
        metadata: {
          title: "Article title",
          "article:published_time": "2026-04-12T08:00:00.000Z",
        },
      }),
    );
    const provider = createSerperFetchProvider(defaultConfig);

    // Act
    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(postMock).toHaveBeenCalledWith(
      "https://scrape.serper.dev",
      expect.objectContaining({
        json: { url: "http://example.com" },
        headers: expect.objectContaining({
          "X-API-KEY": "serper-key",
        }),
      }),
    );
    expect(result).toEqual({
      content: "Article body",
      title: "Article title",
      publishedTime: "2026-04-12T08:00:00.000Z",
    });
  });

  it("normalizes a response without metadata", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        text: "Article body",
      }),
    );
    const provider = createSerperFetchProvider(defaultConfig);

    // Act
    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(result).toEqual({
      content: "Article body",
    });
  });

  it("throws on schema mismatch", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        text: 123,
      }),
    );
    const provider = createSerperFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { post: postMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow();
  });

  it("retries a 429 then returns the successful response", async () => {
    // Setup
    const postMock = vi
      .fn()
      .mockRejectedValueOnce(createTestHttpError(429, { "retry-after": "0" }))
      .mockReturnValueOnce(mockGotPostResponse({ text: "Article body" }));
    const rateLimiter = mockRateLimiter();
    const provider = createSerperFetchProvider({
      ...defaultConfig,
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 8 },
    });

    // Act
    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(result).toEqual({ content: "Article body" });
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(rateLimiter.acquire).toHaveBeenCalledTimes(2);
    expect(rateLimiter.recordResponse).toHaveBeenCalledWith(429);
  });

  it("throws when text is empty", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        text: "  ",
      }),
    );
    const provider = createSerperFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { post: postMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow("Semantic validation failed");
  });
});
