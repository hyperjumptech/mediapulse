/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  dataCollectionAgentConfigSchema,
  getConfigSchema,
} from "./config-schema";

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
      webFetch: {
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
      },
    };

    // Act
    const parsed = dataCollectionAgentConfigSchema.parse(config);

    // Assert
    expect(parsed.webSearch.baseUrl).toBe("https://google.serper.dev");
    expect(parsed.webFetch.baseUrl).toBe("https://r.jina.ai");
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
      webFetch: {
        baseUrl: "https://r.jina.ai",
        authentication: {
          type: "bearer" as const,
          apiKey: "key",
          headerName: "Authorization",
        },
        rateLimit: { requests: 10, perSeconds: 60 },
      },
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
});
