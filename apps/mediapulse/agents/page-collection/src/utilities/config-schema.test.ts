/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { ConfigSchema, getConfigSchema } from "./config-schema";

describe("ConfigSchema", () => {
  it("parses an empty object into the full default config", async () => {
    const result = await ConfigSchema.parseAsync({});

    expect(result.curatedSources).toEqual([]);
    expect(result.defaultDiscoveryChain).toEqual([
      "rss",
      "sitemap",
      "generic-links",
    ]);
    expect(result.gates.relevance.enabled).toBe(true);
    expect(result.gates.freshness.enabled).toBe(true);
    expect(result.resilience.deadUrlCache.enabled).toBe(true);
    expect(result.resilience.hostErrorBreaker.enabled).toBe(true);
    expect(result.runPolicy.minSuccessfulSources).toBe(1);
  });

  it("accepts a curatedSource with listingUrl only (inherits default chain)", async () => {
    const result = await ConfigSchema.parseAsync({
      curatedSources: [{ listingUrl: "https://example.com/feed" }],
    });

    expect(result.curatedSources[0]).toMatchObject({
      listingUrl: "https://example.com/feed",
      enabled: true,
    });
    expect(result.curatedSources[0]?.strategies).toBeUndefined();
  });

  it("accepts a curatedSource with a strategies override", async () => {
    const result = await ConfigSchema.parseAsync({
      curatedSources: [
        {
          listingUrl: "https://example.com/news",
          strategies: ["generic-links"],
        },
      ],
    });

    expect(result.curatedSources[0]?.strategies).toEqual(["generic-links"]);
  });

  it("rejects an unknown strategy value in curatedSources", async () => {
    await expect(
      ConfigSchema.parseAsync({
        curatedSources: [
          {
            listingUrl: "https://example.com/feed",
            strategies: ["unknown-strategy"],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("rejects an empty strategies array in curatedSources", async () => {
    await expect(
      ConfigSchema.parseAsync({
        curatedSources: [
          { listingUrl: "https://example.com/feed", strategies: [] },
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

  it("defaultDiscoveryChain defaults to [rss, sitemap, generic-links]", async () => {
    const result = await ConfigSchema.parseAsync({});

    expect(result.defaultDiscoveryChain).toEqual([
      "rss",
      "sitemap",
      "generic-links",
    ]);
  });

  it("rejects an empty defaultDiscoveryChain", async () => {
    await expect(
      ConfigSchema.parseAsync({ defaultDiscoveryChain: [] }),
    ).rejects.toBeInstanceOf(Error);
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
    expect(properties).toHaveProperty("defaultDiscoveryChain");
    expect(properties).toHaveProperty("gates");
    expect(properties).toHaveProperty("resilience");
  });
});
