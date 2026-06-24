/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

import { createExaFetchProvider } from "./exa";
import type { FetchProviderConfig } from "./types";
import { mockRateLimiter } from "./test-fixtures";

const defaultConfig: FetchProviderConfig = {
  type: "exa",
  baseUrl: "https://api.exa.ai/contents",
  authentication: { type: "none", apiKey: "exa-key", headerName: "x-api-key" },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 1,
};

const mockGotPostResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
});

describe("createExaFetchProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts text and sets the x-api-key header", async () => {
    const postMock = vi.fn().mockReturnValue(
      mockGotPostResponse({
        results: [
          {
            text: "Article body",
            title: "Article title",
            publishedDate: "2026-06-20T00:00:00.000Z",
          },
        ],
      }),
    );
    const provider = createExaFetchProvider(defaultConfig);

    const result = await provider.fetchOne("http://example.com", {
      gotClient: { post: postMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(postMock).toHaveBeenCalledWith(
      "https://api.exa.ai/contents",
      expect.objectContaining({
        json: { urls: ["http://example.com"], text: true },
        headers: expect.objectContaining({ "x-api-key": "exa-key" }),
      }),
    );
    expect(result).toEqual({
      content: "Article body",
      title: "Article title",
      publishedTime: "2026-06-20T00:00:00.000Z",
    });
  });

  it("throws when no content is returned", async () => {
    const postMock = vi
      .fn()
      .mockReturnValue(mockGotPostResponse({ results: [] }));
    const provider = createExaFetchProvider(defaultConfig);

    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { post: postMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow("Semantic validation failed");
  });
});
