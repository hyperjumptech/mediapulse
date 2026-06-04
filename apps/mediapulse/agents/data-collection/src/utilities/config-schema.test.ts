/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  dataCollectionAgentConfigSchema,
  defaultDiffbotFetchProvider,
  defaultFetchProviders,
  defaultFirecrawlFetchProvider,
  defaultJinaFetchProvider,
  defaultSerperFetchProvider,
  getConfigSchema,
  isUnresolvedVariablePlaceholder,
} from "./config-schema";

describe("getConfigSchema", () => {
  it("returns wrapped JSON schema with agentId", () => {
    // Act
    const result = getConfigSchema();

    // Assert
    expect(result.agentId).toBe("data-collection");
    expect(result.schema).toHaveProperty("type", "object");
    expect(result.schema).toHaveProperty("properties");
    const properties = (
      result.schema as { properties?: Record<string, unknown> }
    ).properties;
    expect(Object.keys(properties ?? {})).toEqual([
      "providers",
      "collection",
      "gates",
      "resilience",
      "deduplication",
      "runPolicy",
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
    // Act
    const parsed = dataCollectionAgentConfigSchema.parse({});

    // Assert
    expect(parsed.providers.search.baseUrl).toBe(
      "https://google.serper.dev/search",
    );
    expect(parsed.providers.search.authentication.apiKey).toBe(
      "{{SERPER_API_KEY}}",
    );
    expect(parsed.providers.search.authentication.type).toBe("none");
    expect(parsed.providers.search.query).toEqual({
      country: "id",
      language: "auto",
      dateRange: "past_week",
      type: "news",
    });
    expect(
      parsed.providers.fetch.providers.map((provider) => provider.type),
    ).toEqual(["serper", "diffbot", "firecrawl", "jina"]);
    expect(parsed.providers.fetch.providers[0]).toMatchObject(
      defaultSerperFetchProvider,
    );
    expect(parsed.providers.fetch.providers[1]).toMatchObject(
      defaultDiffbotFetchProvider,
    );
    expect(parsed.providers.fetch.providers[2]).toMatchObject(
      defaultFirecrawlFetchProvider,
    );
    expect(parsed.providers.fetch.providers[3]).toMatchObject(
      defaultJinaFetchProvider,
    );
    expect(parsed.collection).toEqual({
      targetDailySuccessfulSources: 5,
      maxRefillRounds: 3,
      perQueryFetchBudget: 5,
      perRunFetchBudget: 40,
    });
    expect(parsed.gates.relevance).toEqual({
      enabled: true,
      headChars: 3000,
      minMatches: 1,
    });
    expect(parsed.gates.freshness).toEqual({
      enabled: true,
      maxAgeDays: 14,
      allowUnknown: true,
    });
    expect(parsed.resilience.deadUrlCache).toEqual({
      enabled: true,
      skipLookupBatchSize: 50,
    });
    expect(parsed.resilience.hostErrorBreaker).toEqual({
      enabled: true,
      minAttempts: 5,
      errorRateThreshold: 0.5,
    });
    expect(parsed.deduplication.semantic).toEqual({
      enabled: false,
      threshold: 0.88,
      windowDays: 7,
      embeddingModel: "{{EMBEDDING_MODEL}}",
    });
    expect(parsed.deduplication.openaiApiKey).toBe("{{OPENAI_API_KEY}}");
    expect(parsed.runPolicy).toEqual({
      minSuccessfulSources: 1,
      failOnZeroSuccess: false,
    });
  });

  it("preserves Hermes variable placeholders verbatim", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({});

    expect(parsed.providers.search.authentication.apiKey).toBe(
      "{{SERPER_API_KEY}}",
    );
    expect(parsed.providers.fetch.providers[0]?.authentication.apiKey).toBe(
      "{{SERPER_API_KEY}}",
    );
    expect(parsed.providers.fetch.providers[1]?.authentication.apiKey).toBe(
      "{{DIFFBOT_API_KEY}}",
    );
    expect(parsed.providers.fetch.providers[2]?.authentication.apiKey).toBe(
      "{{FIRECRAWL_API_KEY}}",
    );
    expect(parsed.providers.fetch.providers[3]?.authentication.apiKey).toBe(
      "{{JINA_API_KEY}}",
    );
    expect(parsed.deduplication.openaiApiKey).toBe("{{OPENAI_API_KEY}}");
    expect(parsed.deduplication.semantic.embeddingModel).toBe(
      "{{EMBEDDING_MODEL}}",
    );
  });

  it("keeps other defaults when only one collection field is overridden", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({
      collection: {
        perRunFetchBudget: 12,
      },
    });

    expect(parsed.collection.perRunFetchBudget).toBe(12);
    expect(parsed.collection.perQueryFetchBudget).toBe(5);
    expect(parsed.collection.targetDailySuccessfulSources).toBe(5);
    expect(parsed.providers.fetch.providers).toHaveLength(4);
    expect(parsed.runPolicy.failOnZeroSuccess).toBe(false);
  });

  it("accepts ordered fetch providers under providers.fetch.providers", () => {
    const parsed = dataCollectionAgentConfigSchema.parse({
      providers: {
        fetch: {
          providers: [
            {
              type: "jina",
              baseUrl: "https://r.jina.ai",
              authentication: {
                type: "bearer",
                apiKey: "jina-key",
                headerName: "Authorization",
              },
              rateLimit: {
                requests: 100,
                perSeconds: 60,
              },
            },
            {
              type: "firecrawl",
              baseUrl: "https://api.firecrawl.dev",
              authentication: {
                type: "bearer",
                apiKey: "fc-key",
                headerName: "Authorization",
              },
              rateLimit: {
                requests: 50,
                perSeconds: 60,
              },
            },
          ],
        },
      },
    });

    expect(
      parsed.providers.fetch.providers.map((provider) => provider.type),
    ).toEqual(["jina", "firecrawl"]);
  });

  it("rejects non-positive search rate limits", () => {
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        providers: {
          search: {
            rateLimit: { requests: 0, perSeconds: 60 },
          },
        },
      }),
    ).toThrow();

    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        providers: {
          search: {
            rateLimit: { requests: 10, perSeconds: 0 },
          },
        },
      }),
    ).toThrow();
  });

  it("rejects empty fetch provider arrays", () => {
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        providers: {
          fetch: {
            providers: [],
          },
        },
      }),
    ).toThrow();
  });

  it("rejects invalid collection refill values", () => {
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        collection: {
          targetDailySuccessfulSources: 0,
        },
      }),
    ).toThrow();
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        collection: {
          maxRefillRounds: -1,
        },
      }),
    ).toThrow();
  });

  it("exports the default fetch chain in recommended order", () => {
    expect(defaultFetchProviders.map((provider) => provider.type)).toEqual([
      "serper",
      "diffbot",
      "firecrawl",
      "jina",
    ]);
  });
});
