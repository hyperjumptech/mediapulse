/** @vitest-environment node */

import type got from "got";
import { describe, expect, it } from "vitest";

import {
  createFirecrawlSearchProvider,
  createFirecrawlSelfhostedSearchProvider,
} from "./firecrawl";
import type { SearchProviderContext } from "./types";

interface CapturedRequest {
  url: string;
  headers: Record<string, string>;
  json: Record<string, unknown>;
}

/** Builds a context whose gotClient records the request and returns `body`. */
const makeCtx = (
  body: unknown,
  captured: CapturedRequest[],
): SearchProviderContext => ({
  gotClient: {
    post: async (
      url: string,
      options: {
        headers: Record<string, string>;
        json: Record<string, unknown>;
      },
    ) => {
      captured.push({ url, headers: options.headers, json: options.json });

      return { body: JSON.stringify(body) };
    },
  } as unknown as typeof got,
  locale: { gl: "id", hl: "id" },
  page: 0,
  timeoutMs: 1000,
  logger: { info: () => {}, warn: () => {} },
});

describe("createFirecrawlSearchProvider (cloud)", () => {
  it("uses bearer auth against the default cloud endpoint and parses news hits", async () => {
    const captured: CapturedRequest[] = [];
    const provider = createFirecrawlSearchProvider({ apiKey: "secret" });
    const ctx = makeCtx(
      {
        success: true,
        data: {
          news: [
            {
              url: "https://e.com/a",
              title: "T",
              snippet: "S",
              date: "2026-06-20",
            },
            { title: "no url" },
          ],
        },
        creditsUsed: 3,
      },
      captured,
    );

    const result = await provider.search("saham", ctx);

    expect(provider.type).toBe("firecrawl");
    expect(captured[0]?.url).toBe("https://api.firecrawl.dev/v2/search");
    expect(captured[0]?.headers.Authorization).toBe("Bearer secret");
    expect(captured[0]?.json).toMatchObject({
      query: "saham",
      sources: [{ type: "news" }],
      country: "id",
    });
    expect(result.hits).toEqual([
      {
        url: "https://e.com/a",
        title: "T",
        snippet: "S",
        publishedAt: "2026-06-20",
      },
    ]);
    expect(result.credits).toBe(3);
  });

  it("honors a base URL override", async () => {
    const captured: CapturedRequest[] = [];
    const provider = createFirecrawlSearchProvider({
      apiKey: "k",
      baseUrl: "https://proxy.example.com/",
    });
    const ctx = makeCtx({ success: true, data: { news: [] } }, captured);

    await provider.search("q", ctx);

    expect(captured[0]?.url).toBe("https://proxy.example.com/v2/search");
  });
});

describe("createFirecrawlSelfhostedSearchProvider", () => {
  it("sends custom headers without bearer auth and falls back to web results", async () => {
    const captured: CapturedRequest[] = [];
    const provider = createFirecrawlSelfhostedSearchProvider({
      baseUrl: "https://firecrawl.internal",
      headers: {
        "X-Auth-Id": "id",
        "X-Auth-Secret": "sec",
      },
    });
    const ctx = makeCtx(
      {
        success: true,
        data: {
          web: [{ url: "https://e.com/b", title: "T", description: "D" }],
        },
        creditsUsed: 2,
      },
      captured,
    );

    const result = await provider.search("berita", ctx);

    expect(provider.type).toBe("firecrawl_selfhosted");
    expect(captured[0]?.url).toBe("https://firecrawl.internal/v2/search");
    expect(captured[0]?.headers.Authorization).toBeUndefined();
    expect(captured[0]?.headers["X-Auth-Id"]).toBe("id");
    expect(captured[0]?.headers["X-Auth-Secret"]).toBe("sec");
    expect(result.hits).toEqual([
      { url: "https://e.com/b", title: "T", snippet: "D" },
    ]);
    expect(result.credits).toBe(2);
  });

  it("prefers news over web when both are present", async () => {
    const captured: CapturedRequest[] = [];
    const provider = createFirecrawlSelfhostedSearchProvider({
      baseUrl: "https://firecrawl.internal",
    });
    const ctx = makeCtx(
      {
        success: true,
        data: {
          news: [{ url: "https://news/1", title: "N", snippet: "NS" }],
          web: [{ url: "https://web/1", title: "W", description: "WD" }],
        },
      },
      captured,
    );

    const result = await provider.search("q", ctx);

    expect(result.hits).toEqual([
      { url: "https://news/1", title: "N", snippet: "NS" },
    ]);
  });

  it("throws when the response reports success: false", async () => {
    const captured: CapturedRequest[] = [];
    const provider = createFirecrawlSelfhostedSearchProvider({
      baseUrl: "https://firecrawl.internal",
    });
    const ctx = makeCtx({ success: false }, captured);

    await expect(provider.search("q", ctx)).rejects.toThrow();
  });
});
