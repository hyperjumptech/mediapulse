/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { pageCollectionUrlOutcomeInputSchema } from "./page-collection-url-outcome.js";

describe("pageCollectionUrlOutcomeInputSchema", () => {
  it("accepts a collected outcome with curated-source lineage", () => {
    // Setup
    const input = {
      id: "11111111-1111-4111-a111-111111111111",
      runId: "22222222-2222-4222-a222-222222222222",
      tickerId: "BBCA",
      status: "collected" as const,
      url: "https://example.com/article",
      source: "https://example.com/rss",
      curatedSourceId: "33333333-3333-4333-a333-333333333333",
      createdAt: "2026-05-21T12:00:00.000Z",
    };

    // Act
    const parsed = pageCollectionUrlOutcomeInputSchema.parse(input);

    // Assert
    expect(parsed.status).toBe("collected");
    expect(parsed.curatedSourceId).toBe("33333333-3333-4333-a333-333333333333");
  });

  it("accepts a dropped outcome with a reason", () => {
    const input = {
      id: "11111111-1111-4111-a111-111111111111",
      runId: "22222222-2222-4222-a222-222222222222",
      status: "dropped" as const,
      url: "https://example.com/old",
      reason: "freshness_too_old",
      reasonDetail: "Published 2019-03-12, older than the window",
      createdAt: "2026-05-21T12:00:00.000Z",
    };

    const parsed = pageCollectionUrlOutcomeInputSchema.parse(input);

    expect(parsed.reason).toBe("freshness_too_old");
  });
});
