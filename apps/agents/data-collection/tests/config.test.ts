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
      searchSources: {
        "serper-dev": {
          enabled: true,
          type: "rest",
          baseUrl: "https://google.serper.dev",
          authentication: {
            type: "api-key",
            apiKey: "key",
            headerName: "X-API-KEY",
          },
          rateLimit: {
            requests: 100,
            perSeconds: 60,
          },
          requestConfig: {
            method: "POST",
            endpoint: "/search",
            queryParamName: "q",
          },
          responseMapping: {
            resultsPath: "organic",
            urlPath: "link",
            titlePath: "title",
          },
          healthCheck: {
            enabled: true,
            interval: 60,
          },
        },
      },
      webFetching: {
        enabled: true,
        timeout: 10000,
        retries: 3,
        retryDelay: 1000,
        userAgent: "mediapulse-data-collection",
        maxContentLength: 500000,
        javascriptRendering: {
          enabled: false,
          headless: true,
          waitTime: 1000,
        },
        contentExtraction: {
          enabled: true,
          removeAds: true,
          removeNavigation: true,
          extractMainContent: true,
          preserveImages: false,
          preserveLinks: true,
        },
        robotsTxt: {
          enabled: true,
          userAgent: "mediapulse-bot",
        },
        proxyRotation: {
          enabled: false,
          proxies: [],
          rotationStrategy: "round-robin",
        },
      },
      processing: {
        deduplication: {
          enabled: true,
          similarityThreshold: 0.8,
          methods: ["title", "content"],
          aiDeduplication: false,
        },
        filtering: {
          enabled: true,
          minContentLength: 100,
          maxContentLength: 20000,
          blocklistDomains: [],
        },
        optimization: {
          enabled: true,
          compressHtml: true,
          normalizeWhitespace: true,
          extractMetadata: true,
          languageDetection: true,
        },
      },
      queryRetrieval: {
        enabled: true,
        source: "database",
        queryTypes: ["news", "web"],
        maxQueriesPerSource: 10,
        priorityOrder: "relevance",
      },
      errorHandling: {
        continueOnError: true,
        maxErrorsPerSource: 5,
        errorNotification: {
          enabled: false,
          channels: [],
        },
      },
    };

    // Act
    const parsed = dataCollectionAgentConfigSchema.parse(config);

    // Assert
    expect(parsed.searchSources["serper-dev"].baseUrl).toBe(
      "https://google.serper.dev",
    );
  });
});
