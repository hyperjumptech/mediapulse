/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { ConfigSchema } from "./config-schema";

describe("ConfigSchema", () => {
  it("exposes exactly the configurable Hermes form sections", () => {
    expect(Object.keys(ConfigSchema.shape)).toEqual([
      "collection",
      "publisher_authority",
    ]);
  });

  it("defaults publisher authority to the expanded key and the provider's monthly cadence", () => {
    const parsed = ConfigSchema.parse({});

    expect(parsed.publisher_authority).toEqual({
      apiKey: "{{OPEN_PAGE_RANK_API_KEY}}",
      ttlDays: 30,
    });
  });

  it("parses an empty object into the full recommended config", () => {
    const parsed = ConfigSchema.parse({});

    expect(parsed.collection).toEqual({
      maxDiscoveredItemsPerRun: 500,
      perRunCandidateBudget: 50,
    });
  });

  it("keeps other defaults when only one collection field is overridden", () => {
    const parsed = ConfigSchema.parse({
      collection: { perRunCandidateBudget: 20 },
    });

    expect(parsed.collection.perRunCandidateBudget).toBe(20);
    expect(parsed.collection.maxDiscoveredItemsPerRun).toBe(500);
  });

  it("rejects invalid collection values", () => {
    expect(() =>
      ConfigSchema.parse({
        collection: { perRunCandidateBudget: 0 },
      }),
    ).toThrow();
    expect(() =>
      ConfigSchema.parse({
        collection: { maxDiscoveredItemsPerRun: 0 },
      }),
    ).toThrow();
  });

  it("strips stored keys for sections that are no longer configurable", () => {
    const parsed = ConfigSchema.parse({
      providers: { fetch: { providers: [] } },
      resilience: { deadUrlCache: { enabled: false } },
      discovery: { timeoutMs: 1000 },
      run: { maxDurationMs: 1000 },
      runPolicy: { minSuccessfulSources: 2 },
      collection: { perRunCandidateBudget: 20 },
    });

    expect(Object.keys(parsed)).toEqual(["collection", "publisher_authority"]);
    expect(parsed.collection.perRunCandidateBudget).toBe(20);
  });
});
