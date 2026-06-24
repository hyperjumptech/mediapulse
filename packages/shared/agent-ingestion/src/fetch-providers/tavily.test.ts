/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

import { createTavilyFetchProvider } from "./tavily";
import type { FetchProviderConfig } from "./types";
import { mockRateLimiter } from "./test-fixtures";

const defaultConfig: FetchProviderConfig = {
  type: "tavily",
  baseUrl: "https://api.tavily.com/extract",
  authentication: { type: "bearer", apiKey: "tavily-key" },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 1,
};

const mockGotPostResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
});

describe("createTavilyFetchProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts raw_content and sets a bearer header", async () => {
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        results: [{ raw_content: "Article body" }],
      }),
    );
    const provider = createTavilyFetchProvider(defaultConfig);

    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(postMock).toHaveBeenCalledWith(
      "https://api.tavily.com/extract",
      expect.objectContaining({
        json: { urls: ["http://example.com"] },
        headers: expect.objectContaining({
          Authorization: "Bearer tavily-key",
        }),
      }),
    );
    expect(result).toEqual({ content: "Article body" });
  });

  it("throws when no content is returned", async () => {
    const postMock = vi
      .fn()
      .mockReturnValue(mockGotPostResponse({ results: [] }));
    const provider = createTavilyFetchProvider(defaultConfig);

    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { post: postMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow("Semantic validation failed");
  });
});
