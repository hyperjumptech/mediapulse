/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { pageCollectionFailureInputSchema } from "./page-collection-failure.js";

describe("pageCollectionFailureInputSchema", () => {
  it("accepts a web-fetch failure without a search query", () => {
    // Setup
    const input = {
      id: "11111111-1111-4111-a111-111111111111",
      runId: "22222222-2222-4222-a222-222222222222",
      tickerId: "BBCA",
      stage: "web-fetch" as const,
      provider: "firecrawl" as const,
      url: "https://example.com/article",
      errorCategory: "provider_http_error" as const,
      retryable: false,
      message: "Provider failed",
      createdAt: "2026-05-21T12:00:00.000Z",
    };

    // Act
    const parsed = pageCollectionFailureInputSchema.parse(input);

    // Assert
    expect(parsed.provider).toBe("firecrawl");
    expect(parsed.stage).toBe("web-fetch");
  });
});
