/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

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
