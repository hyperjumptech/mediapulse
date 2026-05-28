/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

import { createJinaFetchProvider } from "./jina";
import type { FetchProviderConfig } from "./types";
import { mockRateLimiter } from "./test-fixtures";

const defaultConfig: FetchProviderConfig = {
  type: "jina",
  baseUrl: "https://r.jina.ai/",
  authentication: {
    type: "bearer",
    apiKey: "jina-key",
    headerName: "Authorization",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 4,
};

/** Builds a got POST response stub with HTTP status metadata. */
const mockGotPostResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
});

describe("createJinaFetchProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses and normalizes a successful Jina response", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: {
          url: "http://example.com",
          title: "Title",
          content: "Full content",
          publishedTime: "2026-04-12T08:00:00.000Z",
          published_at: "2026-04-12T09:00:00.000Z",
          usage: { tokens: 42 },
        },
      }),
    );
    const provider = createJinaFetchProvider(defaultConfig);

    // Act
    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
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
    expect(result).toEqual({
      url: "http://example.com",
      title: "Title",
      content: "Full content",
      publishedTime: "2026-04-12T08:00:00.000Z",
      published_at: "2026-04-12T09:00:00.000Z",
      usage: { tokens: 42 },
    });
  });

  it("throws on schema mismatch", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: "not-an-object",
      }),
    );
    const provider = createJinaFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { post: postMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow();
  });

  it("throws when content is empty", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        data: {
          url: "http://example.com",
          title: "Title",
          content: "   ",
        },
      }),
    );
    const provider = createJinaFetchProvider(defaultConfig);

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
