/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

import { createFirecrawlFetchProvider } from "./firecrawl";
import type { FetchProviderConfig } from "./types";
import { mockRateLimiter } from "./test-fixtures";

const defaultConfig: FetchProviderConfig = {
  type: "firecrawl",
  baseUrl: "https://api.firecrawl.dev",
  authentication: {
    type: "bearer",
    apiKey: "fc-key",
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

describe("createFirecrawlFetchProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses and normalizes a successful Firecrawl response", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        success: true,
        data: {
          markdown: "# Article body",
          metadata: {
            title: "Article title",
            publishedTime: "2026-04-12T08:00:00.000Z",
          },
        },
      }),
    );
    const provider = createFirecrawlFetchProvider(defaultConfig);

    // Act
    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(postMock).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v2/scrape",
      expect.objectContaining({
        json: { url: "http://example.com", formats: ["markdown"] },
        headers: expect.objectContaining({
          Authorization: "Bearer fc-key",
        }),
      }),
    );
    expect(result).toEqual({
      content: "# Article body",
      title: "Article title",
      publishedTime: "2026-04-12T08:00:00.000Z",
    });
  });

  it("serves firecrawl_selfhosted with custom headers, no bearer, and its own type", async () => {
    // Setup
    const selfhostedConfig: FetchProviderConfig = {
      type: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      authentication: { type: "none" },
      headers: {
        "X-Auth-Id": "auth-id",
        "X-Auth-Secret": "auth-secret",
      },
      rateLimit: { requests: 1, perSeconds: 1 },
    };
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        success: true,
        data: { markdown: "# Body" },
      }),
    );
    const provider = createFirecrawlFetchProvider(selfhostedConfig);

    // Act
    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(provider.type).toBe("firecrawl_selfhosted");
    const [calledUrl, calledOptions] = postMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];

    expect(calledUrl).toBe("https://firecrawl.internal/v2/scrape");
    expect(calledOptions.headers["X-Auth-Id"]).toBe("auth-id");
    expect(calledOptions.headers["X-Auth-Secret"]).toBe("auth-secret");
    expect(calledOptions.headers.Authorization).toBeUndefined();
    expect(result).toEqual({ content: "# Body" });
  });

  it("throws when success is false", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        success: false,
        data: { markdown: "ignored" },
      }),
    );
    const provider = createFirecrawlFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { post: postMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow("Semantic validation failed");
  });

  it("throws on schema mismatch", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        ok: true,
      }),
    );
    const provider = createFirecrawlFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { post: postMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow();
  });

  it("throws when markdown is empty", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        success: true,
        data: { markdown: "  " },
      }),
    );
    const provider = createFirecrawlFetchProvider(defaultConfig);

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
