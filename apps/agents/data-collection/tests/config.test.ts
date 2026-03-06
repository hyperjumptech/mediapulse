import { describe, expect, it } from "vitest";

import {
  dataCollectionAgentConfigSchema,
  getConfigSchema,
} from "../src/utilities/config-schema.js";

describe("config", () => {
  it("returns wrapped JSON schema with agentId", () => {
    // Act
    const result = getConfigSchema();

    // Assert
    expect(result.agentId).toBe("data-collection");
    expect(result.schema).toHaveProperty("type", "object");
    expect(result.schema).toHaveProperty("properties");
  });

  it("accepts a minimal valid config object", () => {
    // Setup
    const config = {
      webSearch: {
        "serper-dev": {
          baseUrl: "https://google.serper.dev",
          authentication: {
            type: "bearer",
            apiKey: "key",
            headerName: "X-API-KEY",
          },
          rateLimit: {
            requests: 100,
            perSeconds: 60,
          },
        },
      },
      webFetch: {
        jina: {
          baseUrl: "https://r.jina.ai",
          authentication: {
            type: "bearer",
            apiKey: "key",
            headerName: "Authorization",
          },
          rateLimit: {
            requests: 100,
            perSeconds: 60,
          },
        },
      },
    };

    // Act
    const parsed = dataCollectionAgentConfigSchema.parse(config);

    // Assert
    expect(parsed.webSearch["serper-dev"]?.baseUrl).toBe(
      "https://google.serper.dev",
    );
  });
});
