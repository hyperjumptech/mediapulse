/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { ConfigSchema, getConfigSchema } from "./config-schema";

describe("ConfigSchema", () => {
  it("parses an empty object into the full default config", async () => {
    const result = await ConfigSchema.parseAsync({});

    expect(result.resilience.deadUrlCache.enabled).toBe(true);
    expect(result.resilience.hostErrorBreaker.enabled).toBe(true);
    expect(result.runPolicy.minSuccessfulSources).toBe(1);
    expect(result.collection.perRunCandidateBudget).toBe(50);
  });

  it("accepts collection cap overrides", async () => {
    const result = await ConfigSchema.parseAsync({
      collection: { perRunCandidateBudget: 20 },
    });

    expect(result.collection.perRunCandidateBudget).toBe(20);
  });

  it("no longer exposes a fetch provider group", async () => {
    const result = await ConfigSchema.parseAsync({});

    expect(result).not.toHaveProperty("providers");
  });

  it("strips stored fetch provider keys instead of rejecting them", async () => {
    const result = await ConfigSchema.parseAsync({
      providers: {
        fetch: {
          providers: [
            {
              type: "firecrawl_selfhosted",
              baseUrl: "https://firecrawl.internal",
              authentication: { type: "none" },
              rateLimit: { requests: 1, perSeconds: 1 },
            },
          ],
        },
      },
      runPolicy: { minSuccessfulSources: 2 },
    });

    expect(result).not.toHaveProperty("providers");
    expect(result.runPolicy.minSuccessfulSources).toBe(2);
  });
});

describe("getConfigSchema", () => {
  it("returns wrapped JSON Schema with agentId page-collection", () => {
    const result = getConfigSchema();

    expect(result.agentId).toBe("page-collection");
    expect(result.schema).toHaveProperty("type", "object");
  });
});
