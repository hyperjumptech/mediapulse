/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { pageCollectionRunInputSchema } from "./page-collection-run.js";

describe("pageCollectionRunInputSchema", () => {
  it("accepts a run with a grouped snapshot", () => {
    // Setup
    const input = {
      id: "11111111-1111-4111-a111-111111111111",
      tickerId: "BBCA",
      startedAt: "2026-05-21T12:00:00.000Z",
      completedAt: "2026-05-21T12:03:00.000Z",
      status: "success" as const,
      snapshot: {
        agentId: "page-collection",
        agentVersion: "2.0.0",
        cost: { searchCredits: 0, searchCreditsByProvider: {} },
        result: {
          saved: 12,
          excluded: 4,
          byReason: { existing: 3, freshness: 1 },
        },
        timing: {
          totalMs: 180000,
          roundsExecuted: 2,
          stopReason: "daily_target_met",
        },
      },
    };

    // Act
    const parsed = pageCollectionRunInputSchema.parse(input);

    // Assert
    expect(parsed.snapshot.result.saved).toBe(12);
    expect(parsed.snapshot.agentVersion).toBe("2.0.0");
  });

  it("rejects a run missing the snapshot", () => {
    const input = {
      id: "11111111-1111-4111-a111-111111111111",
      startedAt: "2026-05-21T12:00:00.000Z",
      completedAt: "2026-05-21T12:03:00.000Z",
      status: "success" as const,
    };

    expect(() => pageCollectionRunInputSchema.parse(input)).toThrow();
  });
});
