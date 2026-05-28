/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { dataCollectionFailureInputSchema } from "./data-collection-failure.js";

describe("dataCollectionFailureInputSchema", () => {
  it("accepts firecrawl and diffbot web-fetch providers", () => {
    // Setup
    const base = {
      id: "11111111-1111-4111-a111-111111111111",
      runId: "22222222-2222-4222-a222-222222222222",
      tickerId: "BBCA",
      stage: "web-fetch" as const,
      searchQueryId: "33333333-3333-4333-a333-333333333333",
      url: "https://example.com/article",
      errorCategory: "provider_http_error" as const,
      retryable: false,
      message: "Provider failed",
      createdAt: "2026-05-21T12:00:00.000Z",
    };

    // Act + Assert
    expect(
      dataCollectionFailureInputSchema.parse({
        ...base,
        provider: "firecrawl",
      }).provider,
    ).toBe("firecrawl");
    expect(
      dataCollectionFailureInputSchema.parse({
        ...base,
        provider: "diffbot",
      }).provider,
    ).toBe("diffbot");
  });
});
