import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  expandFetchProviderEntries,
  expandFetchProviderEntry,
  fetchProviderEntrySchema,
} from "./schemas";

describe("fetchProviderEntrySchema", () => {
  it("parses an API-key entry with only provider and apiKey", () => {
    const parsed = fetchProviderEntrySchema.parse({
      provider: "serper",
      apiKey: "{{SERPER_API_KEY}}",
    });

    expect(parsed).toEqual({
      provider: "serper",
      apiKey: "{{SERPER_API_KEY}}",
    });
  });

  it("parses a self-hosted entry with baseUrl and headers", () => {
    const parsed = fetchProviderEntrySchema.parse({
      provider: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      headers: { "X-Internal-Token": "secret" },
    });

    expect(parsed).toEqual({
      provider: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      headers: { "X-Internal-Token": "secret" },
    });
  });

  it("accepts optional rateLimit and timeoutMs overrides", () => {
    const parsed = fetchProviderEntrySchema.parse({
      provider: "jina",
      apiKey: "jina-key",
      rateLimit: { requests: 5, perSeconds: 2 },
      timeoutMs: 15_000,
    });

    expect(parsed).toEqual({
      provider: "jina",
      apiKey: "jina-key",
      rateLimit: { requests: 5, perSeconds: 2 },
      timeoutMs: 15_000,
    });
  });

  it("rejects a misspelled provider name", () => {
    const result = fetchProviderEntrySchema.safeParse({
      provider: "diffbott",
      apiKey: "key",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes a stored legacy serper entry", () => {
    const parsed = fetchProviderEntrySchema.parse({
      type: "serper",
      baseUrl: "https://scrape.serper.dev",
      authentication: {
        type: "none",
        apiKey: "{{SERPER_API_KEY}}",
        headerName: "X-API-KEY",
      },
      rateLimit: { requests: 1, perSeconds: 1 },
      concurrency: 1,
      timeoutMs: 45_000,
      retry: { maxAttempts: 1, baseDelayMs: 1000, maxDelayMs: 10_000 },
    });

    expect(parsed).toEqual({
      provider: "serper",
      apiKey: "{{SERPER_API_KEY}}",
      rateLimit: { requests: 1, perSeconds: 1 },
      timeoutMs: 45_000,
    });
  });

  it("normalizes a stored legacy self-hosted entry with baseUrl", () => {
    const parsed = fetchProviderEntrySchema.parse({
      type: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      authentication: { type: "none" },
      headers: { "X-Internal-Token": "secret" },
      rateLimit: { requests: 2, perSeconds: 1 },
    });

    expect(parsed).toEqual({
      provider: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      headers: { "X-Internal-Token": "secret" },
      rateLimit: { requests: 2, perSeconds: 1 },
    });
  });

  it("parses a mixed array of one legacy and one new entry", () => {
    const parsed = z.array(fetchProviderEntrySchema).parse([
      {
        type: "diffbot",
        baseUrl: "https://api.diffbot.com",
        authentication: { type: "none", apiKey: "{{DIFFBOT_API_KEY}}" },
        rateLimit: { requests: 1, perSeconds: 1 },
      },
      { provider: "tavily", apiKey: "tavily-key" },
    ]);

    expect(parsed).toEqual([
      {
        provider: "diffbot",
        apiKey: "{{DIFFBOT_API_KEY}}",
        rateLimit: { requests: 1, perSeconds: 1 },
      },
      { provider: "tavily", apiKey: "tavily-key" },
    ]);
  });

  it("rejects a legacy entry whose type is not a known adapter", () => {
    const result = fetchProviderEntrySchema.safeParse({
      type: "diffbott",
      baseUrl: "https://api.diffbot.com",
      authentication: { type: "none", apiKey: "key" },
    });

    expect(result.success).toBe(false);
  });
});

describe("expandFetchProviderEntry", () => {
  it("applies the per-provider base URL and auth header", () => {
    const expanded = expandFetchProviderEntry({
      provider: "serper",
      apiKey: "serper-key",
    });

    expect(expanded).toEqual({
      type: "serper",
      baseUrl: "https://scrape.serper.dev",
      authentication: {
        type: "none",
        headerName: "X-API-KEY",
        apiKey: "serper-key",
      },
      rateLimit: { requests: 1, perSeconds: 1 },
      concurrency: 1,
      timeoutMs: 45_000,
      retry: { maxAttempts: 1, baseDelayMs: 1000, maxDelayMs: 10_000 },
    });
  });

  it("uses bearer auth for jina", () => {
    const expanded = expandFetchProviderEntry({
      provider: "jina",
      apiKey: "jina-key",
    });

    expect(expanded.baseUrl).toBe("https://r.jina.ai/");
    expect(expanded.authentication).toEqual({
      type: "bearer",
      headerName: "Authorization",
      apiKey: "jina-key",
    });
  });

  it("keeps the operator baseUrl and headers for the self-hosted provider", () => {
    const expanded = expandFetchProviderEntry({
      provider: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      headers: { "X-Internal-Token": "secret" },
    });

    expect(expanded.baseUrl).toBe("https://firecrawl.internal");
    expect(expanded.headers).toEqual({ "X-Internal-Token": "secret" });
    expect(expanded.authentication).toEqual({ type: "none" });
  });

  it("prefers operator overrides over the internal defaults", () => {
    const expanded = expandFetchProviderEntry({
      provider: "firecrawl",
      apiKey: "fc-key",
      rateLimit: { requests: 10, perSeconds: 5 },
      timeoutMs: 5000,
    });

    expect(expanded.rateLimit).toEqual({ requests: 10, perSeconds: 5 });
    expect(expanded.timeoutMs).toBe(5000);
  });

  it("expands an ordered chain in place", () => {
    const expanded = expandFetchProviderEntries([
      { provider: "serper", apiKey: "serper-key" },
      { provider: "diffbot", apiKey: "diffbot-key" },
    ]);

    expect(expanded.map((config) => config.type)).toEqual([
      "serper",
      "diffbot",
    ]);
  });
});
