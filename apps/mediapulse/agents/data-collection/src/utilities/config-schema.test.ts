/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  dataCollectionAgentConfigSchema,
  getConfigSchema,
  isUnresolvedVariablePlaceholder,
} from "./config-schema";

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
      "web_fetch",
      "relevance",
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
    expect(parsed.web_search[0]?.apiKey).toBe("{{SERPER_API_KEY}}");
    expect(parsed.web_fetch.map((entry) => entry.provider)).toEqual([
      "serper",
      "tavily",
      "exa",
    ]);
    expect(parsed.web_search_locales).toEqual([{ gl: "id", hl: "id" }]);
    expect(parsed.relevance).toEqual({
      apiKey: "{{AI_API_KEY}}",
      model: "{{AI_MODEL}}",
      baseUrl: "{{AI_BASE_URL}}",
    });
    expect(parsed.collection).toEqual({
      targetSavedSources: 15,
      maxRounds: 3,
    });
  });

  it("preserves Hermes variable placeholders verbatim", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({});

    expect(parsed.web_search[1]?.apiKey).toBe("{{TAVILY_API_KEY}}");
    expect(parsed.web_fetch[2]?.apiKey).toBe("{{EXA_API_KEY}}");
    expect(parsed.relevance.apiKey).toBe("{{AI_API_KEY}}");
  });

  it("keeps other defaults when only one collection field is overridden", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({
      collection: { maxRounds: 5 },
    });

    expect(parsed.collection.maxRounds).toBe(5);
    expect(parsed.collection.targetSavedSources).toBe(15);
    expect(parsed.web_fetch).toHaveLength(3);
  });

  it("accepts a custom provider pool", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({
      web_search: [{ provider: "tavily", apiKey: "tav-key" }],
      web_fetch: [{ provider: "exa", apiKey: "exa-key" }],
    });

    expect(parsed.web_search).toEqual([
      { provider: "tavily", apiKey: "tav-key" },
    ]);
    expect(parsed.web_fetch).toEqual([{ provider: "exa", apiKey: "exa-key" }]);
  });

  it("rejects empty provider pools", () => {
    expect(() =>
      dataCollectionAgentConfigSchema.parse({ web_search: [] }),
    ).toThrow();
    expect(() =>
      dataCollectionAgentConfigSchema.parse({ web_fetch: [] }),
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
