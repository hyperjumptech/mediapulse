/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { ConfigSchema, getConfigSchema } from "./config-schema";

describe("ConfigSchema", () => {
  it("parses an empty object into the full default config", async () => {
    const result = await ConfigSchema.parseAsync({});

    expect(result.curatedSources).toEqual([]);
    expect(result.gates.relevance.enabled).toBe(true);
    expect(result.gates.freshness.enabled).toBe(true);
    expect(result.resilience.deadUrlCache.enabled).toBe(true);
    expect(result.resilience.hostErrorBreaker.enabled).toBe(true);
    expect(result.runPolicy.minSuccessfulSources).toBe(1);
  });

  it("accepts a curatedSource with listingUrl only (defaults strategy to rss)", async () => {
    const result = await ConfigSchema.parseAsync({
      curatedSources: [{ listingUrl: "https://example.com/feed" }],
    });

    expect(result.curatedSources[0]).toMatchObject({
      listingUrl: "https://example.com/feed",
      strategy: "rss",
      enabled: true,
    });
  });

  it("accepts a curatedSource with an explicit strategy override", async () => {
    const result = await ConfigSchema.parseAsync({
      curatedSources: [
        {
          listingUrl: "https://example.com/news",
          strategy: "generic-links",
        },
      ],
    });

    expect(result.curatedSources[0]?.strategy).toBe("generic-links");
  });

  it("accepts all valid strategy enum values", async () => {
    for (const strategy of ["rss", "sitemap", "generic-links"] as const) {
      const result = await ConfigSchema.parseAsync({
        curatedSources: [{ listingUrl: "https://example.com/feed", strategy }],
      });

      expect(result.curatedSources[0]?.strategy).toBe(strategy);
    }
  });

  it("rejects an unknown strategy value in curatedSources", async () => {
    await expect(
      ConfigSchema.parseAsync({
        curatedSources: [
          {
            listingUrl: "https://example.com/feed",
            strategy: "unknown-strategy",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("rejects a non-URL listingUrl", async () => {
    await expect(
      ConfigSchema.parseAsync({
        curatedSources: [{ listingUrl: "not-a-url" }],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("applies enabled default of true to curatedSources", async () => {
    const result = await ConfigSchema.parseAsync({
      curatedSources: [{ listingUrl: "https://example.com/feed" }],
    });

    expect(result.curatedSources[0]?.enabled).toBe(true);
  });
});

describe("getConfigSchema", () => {
  it("returns wrapped JSON Schema with agentId page-collection", () => {
    const result = getConfigSchema();

    expect(result.agentId).toBe("page-collection");
    expect(result.schema).toHaveProperty("type", "object");
    expect(result.schema).toHaveProperty("properties");
    const properties = (
      result.schema as { properties?: Record<string, unknown> }
    ).properties;
    expect(properties).toHaveProperty("curatedSources");
    expect(properties).not.toHaveProperty("defaultDiscoveryChain");
    expect(properties).toHaveProperty("gates");
    expect(properties).toHaveProperty("resilience");
  });
});
