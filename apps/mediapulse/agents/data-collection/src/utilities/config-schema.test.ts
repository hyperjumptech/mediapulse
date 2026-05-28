/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  dataCollectionAgentConfigSchema,
  getConfigSchema,
} from "./config-schema";

const jinaWebFetchProvider = {
  type: "jina" as const,
  baseUrl: "https://r.jina.ai",
  authentication: {
    type: "bearer" as const,
    apiKey: "key",
    headerName: "Authorization",
  },
  rateLimit: {
    requests: 100,
    perSeconds: 60,
  },
};

const webFetchWithJinaProvider = {
  providers: [jinaWebFetchProvider],
};

describe("getConfigSchema", () => {
  it("returns wrapped JSON schema with agentId", () => {
    // Act
    const result = getConfigSchema();

    // Assert
    expect(result.agentId).toBe("data-collection");
    expect(result.schema).toHaveProperty("type", "object");
    expect(result.schema).toHaveProperty("properties");
  });
});

describe("dataCollectionAgentConfigSchema", () => {
  it("accepts a minimal valid config object", () => {
    // Setup
    const config = {
      webSearch: {
        baseUrl: "https://google.serper.dev",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "X-API-KEY",
        },
        rateLimit: {
          requests: 100,
          perSeconds: 60,
        },
      },
      webFetch: webFetchWithJinaProvider,
      targetDailySuccessfulSources: 5,
      maxRefillRounds: 3,
    };

    // Act
    const parsed = dataCollectionAgentConfigSchema.parse(config);

    // Assert
    expect(parsed.webSearch.baseUrl).toBe("https://google.serper.dev");
    expect(parsed.webFetch.providers).toEqual([
      expect.objectContaining({
        type: "jina",
        baseUrl: "https://r.jina.ai",
      }),
    ]);
    expect(parsed.targetDailySuccessfulSources).toBe(5);
    expect(parsed.maxRefillRounds).toBe(3);
  });

  it("applies relevance gate defaults when omitted", () => {
    // Setup
    const config = {
      webSearch: {
        baseUrl: "https://google.serper.dev",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "X-API-KEY",
        },
        rateLimit: {
          requests: 100,
          perSeconds: 60,
        },
      },
      webFetch: webFetchWithJinaProvider,
      relevanceGate: {
        enabled: true,
        headChars: 1500,
        minMatches: 1,
      },
    };

    // Act
    const parsed = dataCollectionAgentConfigSchema.parse(config);

    // Assert
    expect(parsed.relevanceGate).toEqual({
      enabled: true,
      headChars: 1500,
      minMatches: 1,
    });
  });

  it("rejects non-positive webSearch rate limits", () => {
    const base = {
      webSearch: {
        baseUrl: "https://google.serper.dev",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "X-API-KEY",
        },
        rateLimit: { requests: 0, perSeconds: 60 },
      },
      webFetch: webFetchWithJinaProvider,
    };

    expect(() => dataCollectionAgentConfigSchema.parse(base)).toThrow();

    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        ...base,
        webSearch: {
          ...base.webSearch,
          rateLimit: { requests: 10, perSeconds: 0 },
        },
      }),
    ).toThrow();
  });

  it("accepts ordered webFetch.providers array", () => {
    // Setup
    const config = {
      webSearch: {
        baseUrl: "https://google.serper.dev",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "X-API-KEY",
        },
        rateLimit: {
          requests: 100,
          perSeconds: 60,
        },
      },
      webFetch: {
        providers: [
          {
            type: "jina",
            baseUrl: "https://r.jina.ai",
            authentication: {
              type: "bearer" as const,
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
              type: "bearer" as const,
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
    };

    // Act
    const parsed = dataCollectionAgentConfigSchema.parse(config);

    // Assert
    expect(parsed.webFetch.providers.map((provider) => provider.type)).toEqual([
      "jina",
      "firecrawl",
    ]);
  });

  it("rejects legacy single-object webFetch shape", () => {
    const config = {
      webSearch: {
        baseUrl: "https://google.serper.dev",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "X-API-KEY",
        },
        rateLimit: {
          requests: 100,
          perSeconds: 60,
        },
      },
      webFetch: {
        baseUrl: "https://r.jina.ai",
        authentication: {
          type: "bearer" as const,
          apiKey: "legacy-key",
          headerName: "Authorization",
        },
        rateLimit: {
          requests: 100,
          perSeconds: 60,
        },
      },
    };

    expect(() => dataCollectionAgentConfigSchema.parse(config)).toThrow();
  });

  it("rejects empty webFetch.providers arrays", () => {
    const config = {
      webSearch: {
        baseUrl: "https://google.serper.dev",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "X-API-KEY",
        },
        rateLimit: {
          requests: 100,
          perSeconds: 60,
        },
      },
      webFetch: {
        providers: [],
      },
    };

    expect(() => dataCollectionAgentConfigSchema.parse(config)).toThrow();
  });

  it("rejects invalid refill configuration values", () => {
    // Setup
    const base = {
      webSearch: {
        baseUrl: "https://google.serper.dev",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "X-API-KEY",
        },
        rateLimit: {
          requests: 100,
          perSeconds: 60,
        },
      },
      webFetch: webFetchWithJinaProvider,
    };

    // Act + Assert
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        ...base,
        targetDailySuccessfulSources: 0,
      }),
    ).toThrow();
    expect(() =>
      dataCollectionAgentConfigSchema.parse({
        ...base,
        maxRefillRounds: -1,
      }),
    ).toThrow();
  });
});
