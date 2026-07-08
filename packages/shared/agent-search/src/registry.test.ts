/** @vitest-environment node */

import type got from "got";
import { describe, expect, it } from "vitest";

import { createSearchProvider } from "./registry";
import type { SearchProviderContext } from "./types";

const makeCtx = (body: unknown): SearchProviderContext => ({
  gotClient: {
    post: async () => ({ body: JSON.stringify(body) }),
  } as unknown as typeof got,
  locale: { gl: "id", hl: "id" },
  page: 0,
  timeoutMs: 1000,
  logger: { info: () => {}, warn: () => {} },
});

describe("createSearchProvider", () => {
  it("parses Serper news results", async () => {
    const provider = createSearchProvider({
      provider: "serper",
      apiKey: "k",
    });
    const ctx = makeCtx({
      news: [
        {
          title: "T",
          link: "https://e.com/a",
          snippet: "S",
          date: "2026-06-20",
        },
        { title: "No link" },
      ],
      credits: 2,
    });

    const result = await provider.search("apple", ctx);

    expect(result.hits).toEqual([
      {
        url: "https://e.com/a",
        title: "T",
        snippet: "S",
        publishedAt: "2026-06-20",
      },
    ]);
    expect(result.credits).toBe(2);
  });

  it("parses Tavily results", async () => {
    const provider = createSearchProvider({ provider: "tavily", apiKey: "k" });
    const ctx = makeCtx({
      results: [
        {
          title: "T",
          url: "https://e.com/b",
          content: "C",
          published_date: "2026-06-19",
        },
      ],
    });

    const result = await provider.search("apple", ctx);

    expect(result.hits[0]).toEqual({
      url: "https://e.com/b",
      title: "T",
      snippet: "C",
      publishedAt: "2026-06-19",
    });
  });

  it("parses Exa results and trims text", async () => {
    const provider = createSearchProvider({ provider: "exa", apiKey: "k" });
    const ctx = makeCtx({
      results: [
        {
          title: "T",
          url: "https://e.com/c",
          text: "  some   spaced   text  ",
          publishedDate: "2026-06-18",
        },
      ],
    });

    const result = await provider.search("apple", ctx);

    expect(result.hits[0]).toEqual({
      url: "https://e.com/c",
      title: "T",
      snippet: "some spaced text",
      publishedAt: "2026-06-18",
    });
  });

  it("builds a firecrawl cloud provider", () => {
    const provider = createSearchProvider({
      provider: "firecrawl",
      apiKey: "k",
    });

    expect(provider.type).toBe("firecrawl");
  });

  it("builds a firecrawl_selfhosted provider from baseUrl and headers", () => {
    const provider = createSearchProvider({
      provider: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      headers: { "X-Auth-Id": "id" },
    });

    expect(provider.type).toBe("firecrawl_selfhosted");
  });

  it("throws when firecrawl_selfhosted has no baseUrl", () => {
    expect(() =>
      createSearchProvider({ provider: "firecrawl_selfhosted" }),
    ).toThrow();
  });

  it("throws when a cloud provider is missing its API key", () => {
    expect(() => createSearchProvider({ provider: "serper" })).toThrow();
  });

  it("throws for an unknown provider", () => {
    expect(() =>
      createSearchProvider({
        // @ts-expect-error testing invalid provider
        provider: "bing",
        apiKey: "k",
      }),
    ).toThrow();
  });
});
