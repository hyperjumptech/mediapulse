/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { buildFetchProviderConfigs } from "./fetch-provider-config";

describe("buildFetchProviderConfigs", () => {
  it("expands the fetch-only providers to their transport defaults", () => {
    const configs = buildFetchProviderConfigs([
      { provider: "diffbot", apiKey: "diff-key" },
      { provider: "firecrawl", apiKey: "fire-key" },
      { provider: "jina", apiKey: "jina-key" },
    ]);

    expect(configs).toEqual([
      {
        type: "diffbot",
        baseUrl: "https://api.diffbot.com",
        authentication: { type: "none", apiKey: "diff-key" },
        rateLimit: { requests: 1, perSeconds: 1 },
        concurrency: 1,
        timeoutMs: 45_000,
        retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8_000 },
      },
      {
        type: "firecrawl",
        baseUrl: "https://api.firecrawl.dev",
        authentication: {
          type: "bearer",
          headerName: "Authorization",
          apiKey: "fire-key",
        },
        rateLimit: { requests: 1, perSeconds: 1 },
        concurrency: 1,
        timeoutMs: 45_000,
        retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8_000 },
      },
      {
        type: "jina",
        baseUrl: "https://r.jina.ai/",
        authentication: {
          type: "bearer",
          headerName: "Authorization",
          apiKey: "jina-key",
        },
        rateLimit: { requests: 1, perSeconds: 1 },
        concurrency: 1,
        timeoutMs: 45_000,
        retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8_000 },
      },
    ]);
  });

  it("expands a self-hosted Firecrawl entry with its baseUrl and headers", () => {
    const configs = buildFetchProviderConfigs([
      {
        provider: "firecrawl_selfhosted",
        baseUrl: "https://firecrawl.internal",
        headers: {
          "CF-Access-Client-Id": "id",
          "CF-Access-Client-Secret": "secret",
        },
      },
    ]);

    expect(configs).toEqual([
      {
        type: "firecrawl_selfhosted",
        baseUrl: "https://firecrawl.internal",
        authentication: { type: "none" },
        headers: {
          "CF-Access-Client-Id": "id",
          "CF-Access-Client-Secret": "secret",
        },
        rateLimit: { requests: 1, perSeconds: 1 },
        concurrency: 1,
        timeoutMs: 45_000,
        retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8_000 },
      },
    ]);
  });

  it("threads the configured API key into the search-capable providers", () => {
    const configs = buildFetchProviderConfigs([
      { provider: "serper", apiKey: "serper-key" },
      { provider: "tavily", apiKey: "tavily-key" },
      { provider: "exa", apiKey: "exa-key" },
    ]);

    expect(configs.map((config) => config.type)).toEqual([
      "serper",
      "tavily",
      "exa",
    ]);
    expect(configs.map((config) => config.authentication.apiKey)).toEqual([
      "serper-key",
      "tavily-key",
      "exa-key",
    ]);
  });
});
