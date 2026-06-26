/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";
import type got from "got";

import { createDiffbotFetchProvider } from "./diffbot";
import type { FetchProviderConfig } from "./types";
import { mockRateLimiter } from "./test-fixtures";

const defaultConfig: FetchProviderConfig = {
  type: "diffbot",
  baseUrl: "https://api.diffbot.com",
  authentication: {
    type: "none",
    apiKey: "diffbot-token",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
  concurrency: 4,
};

/** Builds a got GET response stub with HTTP status metadata. */
const mockGotGetResponse = (jsonValue: unknown, statusCode = 200) => ({
  statusCode,
  body: JSON.stringify(jsonValue),
});

describe("createDiffbotFetchProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses and normalizes a successful Diffbot response", async () => {
    // Setup
    const getMock = vi.fn().mockReturnValue(
      mockGotGetResponse({
        objects: [
          {
            text: "Article body",
            title: "Article title",
            date: "2026-04-12T08:00:00.000Z",
          },
        ],
      }),
    );
    const provider = createDiffbotFetchProvider(defaultConfig);

    // Act
    const result = await provider.fetchOne("http://example.com/page", {
      gotClient: { get: getMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(getMock).toHaveBeenCalledWith(
      "https://api.diffbot.com/v3/article?token=diffbot-token&url=http%3A%2F%2Fexample.com%2Fpage",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    );
    expect(result).toEqual({
      content: "Article body",
      title: "Article title",
      publishedTime: "2026-04-12T08:00:00.000Z",
    });
  });

  it("extracts author and site name when present", async () => {
    // Setup
    const getMock = vi.fn().mockReturnValue(
      mockGotGetResponse({
        objects: [
          {
            text: "Article body",
            title: "Article title",
            author: "Jane Reporter",
            siteName: "The Star",
          },
        ],
      }),
    );
    const provider = createDiffbotFetchProvider(defaultConfig);

    // Act
    const result = await provider.fetchOne("http://example.com/page", {
      gotClient: { get: getMock } as unknown as typeof got,
      rateLimiter: mockRateLimiter(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    // Assert
    expect(result).toEqual({
      content: "Article body",
      title: "Article title",
      author: "Jane Reporter",
      source: "The Star",
    });
  });

  it("throws when objects is empty", async () => {
    // Setup
    const getMock = vi.fn().mockReturnValue(
      mockGotGetResponse({
        objects: [],
      }),
    );
    const provider = createDiffbotFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { get: getMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow("Semantic validation failed");
  });

  it("throws on schema mismatch", async () => {
    // Setup
    const getMock = vi.fn().mockReturnValue(
      mockGotGetResponse({
        items: [],
      }),
    );
    const provider = createDiffbotFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { get: getMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow();
  });

  it("throws when the first object has no text", async () => {
    // Setup
    const getMock = vi.fn().mockReturnValue(
      mockGotGetResponse({
        objects: [{ title: "Only title" }],
      }),
    );
    const provider = createDiffbotFetchProvider(defaultConfig);

    // Act + Assert
    await expect(
      provider.fetchOne("http://example.com", {
        gotClient: { get: getMock } as unknown as typeof got,
        rateLimiter: mockRateLimiter(),
        logger: { info: vi.fn(), warn: vi.fn() },
      }),
    ).rejects.toThrow("Semantic validation failed");
  });
});
