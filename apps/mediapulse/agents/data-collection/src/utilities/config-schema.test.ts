/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  dataCollectionAgentConfigSchema,
  getConfigSchema,
  isUnresolvedVariablePlaceholder,
  type ProviderEntry,
} from "./config-schema";

/** Reads apiKey from a provider entry union (API-key providers carry it). */
const apiKeyOf = (entry: ProviderEntry | undefined): string | undefined =>
  entry && "apiKey" in entry ? entry.apiKey : undefined;

describe("getConfigSchema", () => {
  it("returns wrapped JSON schema with agentId", () => {
    const result = getConfigSchema();

    expect(result.agentId).toBe("data-collection");
    expect(result.schema).toHaveProperty("type", "object");
    const properties = (
      result.schema as { properties?: Record<string, unknown> }
    ).properties;

    expect(Object.keys(properties ?? {})).toEqual([
      "web_search",
      "web_search_locales",
      "collection",
    ]);
  });
});

describe("isUnresolvedVariablePlaceholder", () => {
  it("returns true for Hermes placeholder strings", () => {
    expect(isUnresolvedVariablePlaceholder("{{SERPER_API_KEY}}")).toBe(true);
  });

  it("returns false for resolved API keys", () => {
    expect(isUnresolvedVariablePlaceholder("sk-live-key")).toBe(false);
  });
});

describe("dataCollectionAgentConfigSchema", () => {
  it("parses an empty object into the full recommended config", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({});

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
    const parsed = dataCollectionAgentConfigSchema.parse({});

    expect(apiKeyOf(parsed.web_search[1])).toBe("{{TAVILY_API_KEY}}");
  });

  it("keeps other defaults when only one collection field is overridden", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({
      collection: { maxRounds: 5 },
    });

    expect(parsed.collection.maxRounds).toBe(5);
    expect(parsed.collection.targetSavedSources).toBe(50);
  });

  it("accepts a custom provider pool", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({
      web_search: [{ provider: "tavily", apiKey: "tav-key" }],
    });

    expect(parsed.web_search).toEqual([
      { provider: "tavily", apiKey: "tav-key" },
    ]);
  });

  it("rejects empty provider pools", () => {
    expect(() =>
      dataCollectionAgentConfigSchema.parse({ web_search: [] }),
    ).toThrow();
  });

  it("accepts firecrawl and firecrawl_selfhosted in web_search", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({
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
      dataCollectionAgentConfigSchema.parse({
        web_search: [{ provider: "jina", apiKey: "k" }],
      }),
    ).toThrow();
  });

  it("rejects unknown providers", () => {
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        web_search: [{ provider: "bing", apiKey: "k" }],
      }),
    ).toThrow();
  });

  it("rejects invalid collection values", () => {
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        collection: { targetSavedSources: 0 },
      }),
    ).toThrow();
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        collection: { maxRounds: 0 },
      }),
    ).toThrow();
  });
});
