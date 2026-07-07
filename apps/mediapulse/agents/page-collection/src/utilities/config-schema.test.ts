/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { ConfigSchema, getConfigSchema } from "./config-schema";

describe("ConfigSchema", () => {
  it("parses an empty object into the full default config", async () => {
    const result = await ConfigSchema.parseAsync({});

    expect(result.resilience.deadUrlCache.enabled).toBe(true);
    expect(result.resilience.hostErrorBreaker.enabled).toBe(true);
    expect(result.runPolicy.minSuccessfulSources).toBe(1);
    expect(result.collection.perRunFetchBudget).toBe(50);
  });

  it("accepts fetch provider overrides", async () => {
    const result = await ConfigSchema.parseAsync({
      collection: { perRunFetchBudget: 20 },
    });

    expect(result.collection.perRunFetchBudget).toBe(20);
  });

  it("round-trips a self-hosted Firecrawl provider with custom headers", async () => {
    const result = await ConfigSchema.parseAsync({
      providers: {
        fetch: {
          providers: [
            {
              type: "firecrawl_selfhosted",
              baseUrl: "https://firecrawl.internal",
              authentication: { type: "none" },
              headers: {
                "CF-Access-Client-Id": "id",
                "CF-Access-Client-Secret": "secret",
              },
              rateLimit: { requests: 1, perSeconds: 1 },
            },
          ],
        },
      },
    });

    expect(result.providers.fetch.providers[0]).toMatchObject({
      type: "firecrawl_selfhosted",
      baseUrl: "https://firecrawl.internal",
      headers: {
        "CF-Access-Client-Id": "id",
        "CF-Access-Client-Secret": "secret",
      },
    });
  });
});

describe("getConfigSchema", () => {
  it("returns wrapped JSON Schema with agentId page-collection", () => {
    const result = getConfigSchema();

    expect(result.agentId).toBe("page-collection");
    expect(result.schema).toHaveProperty("type", "object");
  });
});
