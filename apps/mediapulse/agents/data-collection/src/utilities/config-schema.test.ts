/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { ConfigSchema, type ProviderEntry } from "./config-schema";

/** Reads apiKey from a provider entry union (API-key providers carry it). */
const apiKeyOf = (entry: ProviderEntry | undefined): string | undefined =>
  entry && "apiKey" in entry ? entry.apiKey : undefined;

describe("ConfigSchema", () => {
  it("exposes the expected Hermes form sections", () => {
    expect(Object.keys(ConfigSchema.shape)).toEqual([
      "web_search",
      "web_search_locales",
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

    expect(parsed.web_search.map((entry) => entry.provider)).toEqual([
      "serper",
      "tavily",
      "exa",
    ]);
    expect(apiKeyOf(parsed.web_search[0])).toBe("{{SERPER_API_KEY}}");
    expect(parsed.web_search_locales).toEqual([{ gl: "id", hl: "id" }]);
    expect(parsed.collection).toEqual({
      targetSavedSources: 50,
      maxRounds: 3,
      startupJitterMs: 30_000,
    });
  });

  it("preserves Hermes variable placeholders verbatim", () => {
    const parsed = ConfigSchema.parse({});

    expect(apiKeyOf(parsed.web_search[1])).toBe("{{TAVILY_API_KEY}}");
  });

  it("keeps other defaults when only one collection field is overridden", () => {
    const parsed = ConfigSchema.parse({
      collection: { maxRounds: 5 },
    });

    expect(parsed.collection.maxRounds).toBe(5);
    expect(parsed.collection.targetSavedSources).toBe(50);
  });

  it("accepts a custom provider pool", () => {
    const parsed = ConfigSchema.parse({
      web_search: [{ provider: "tavily", apiKey: "tav-key" }],
    });

    expect(parsed.web_search).toEqual([
      { provider: "tavily", apiKey: "tav-key" },
    ]);
  });

  it("rejects empty provider pools", () => {
    expect(() => ConfigSchema.parse({ web_search: [] })).toThrow();
  });

  it("accepts firecrawl and firecrawl_selfhosted in web_search", () => {
    const parsed = ConfigSchema.parse({
      web_search: [
        { provider: "firecrawl", apiKey: "fire-key" },
        {
          provider: "firecrawl_selfhosted",
          baseUrl: "https://firecrawl.internal",
        },
      ],
    });

    expect(parsed.web_search.map((entry) => entry.provider)).toEqual([
      "firecrawl",
      "firecrawl_selfhosted",
    ]);
  });

  it("rejects fetch-only providers in web_search", () => {
    expect(() =>
      ConfigSchema.parse({
        web_search: [{ provider: "jina", apiKey: "k" }],
      }),
    ).toThrow();
  });

  it("rejects unknown providers", () => {
    expect(() =>
      ConfigSchema.parse({
        web_search: [{ provider: "bing", apiKey: "k" }],
      }),
    ).toThrow();
  });

  it("rejects invalid collection values", () => {
    expect(() =>
      ConfigSchema.parse({
        collection: { targetSavedSources: 0 },
      }),
    ).toThrow();
    expect(() =>
      ConfigSchema.parse({
        collection: { maxRounds: 0 },
      }),
    ).toThrow();
  });
});
