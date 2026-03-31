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

const defaultConfig = {
  baseUrl: "https://google.serper.dev/search",
  authentication: {
    type: "bearer" as const,
    apiKey: "serper-key",
    headerName: "X-API-KEY",
  },
  rateLimit: { requests: 2, perSeconds: 1 },
};

describe("performWebSearch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when there are no queries", async () => {
    // Act
    const result = await performWebSearch([], {
      config: defaultConfig,
    });

    // Assert
    expect(result).toEqual([]);
  });

  it("calls Serper and maps the first organic result", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({
        organic: [
          {
            link: "http://example.com",
            title: "Title",
            snippet: "Snippet",
          },
        ],
      }),
    });

    const fakeGot = { post: postMock } as unknown as typeof got;
    const queries: SearchQuery[] = [
      { id: "q1", text: "search", tickerId: "ticker-1" },
    ];

    // Act
    const result = await performWebSearch(queries, {
      config: defaultConfig,
      gotClient: fakeGot,
    });

    // Assert
    expect(postMock).toHaveBeenCalledWith(
      "https://google.serper.dev/search",
      expect.objectContaining({
        json: { q: "search" },
        headers: expect.objectContaining({
          "X-API-KEY": "Bearer serper-key",
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
      },
    });
  });

  it("returns failure when Serper returns invalid response shape", async () => {
    // Setup
    const postMock = vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({
        organic: "not-an-array",
      }),
    });

    const fakeGot = { post: postMock } as unknown as typeof got;
    const queries: SearchQuery[] = [
      { id: "q1", text: "search", tickerId: "ticker-1" },
    ];

    // Act
    const result = await performWebSearch(queries, {
      config: defaultConfig,
      gotClient: fakeGot,
    });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      success: false,
      queryId: "q1",
      tickerId: "ticker-1",
      errorCategory: "provider_schema_error",
    });
  });

  it("logs a warning when a query fails", async () => {
    // Setup
    const warnMock = vi.fn();
    const infoMock = vi.fn();
    const postMock = vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({
        organic: "not-an-array",
      }),
    });

    const fakeGot = { post: postMock } as unknown as typeof got;
    const queries: SearchQuery[] = [
      { id: "q1", text: "search", tickerId: "ticker-1" },
    ];

    // Act
    await performWebSearch(queries, {
      config: defaultConfig,
      gotClient: fakeGot,
      logger: { info: infoMock, warn: warnMock },
    });

    // Assert
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryId: "q1",
        errorCategory: "provider_schema_error",
      }),
      "web search: query failed",
    );
  });
});
