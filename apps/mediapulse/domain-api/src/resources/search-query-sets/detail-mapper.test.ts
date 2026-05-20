/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { mapRowToDetailItem } from "./detail-mapper";

describe("mapRowToDetailItem", () => {
  it("includes queries array and JSON textarea fields", () => {
    // Setup
    const row = {
      id: "set-1",
      tickerId: "ticker-1",
      generatedAt: new Date("2026-03-20T12:00:00.000Z"),
      isActive: false,
      strategySnapshot: { queryCount: 2 },
      generationSource: "hybrid_v1",
      agentJobId: null,
      createdAt: new Date("2026-03-20T11:00:00.000Z"),
      updatedAt: new Date("2026-03-20T12:30:00.000Z"),
      ticker: { id: "ticker-1", symbol: "AAPL", name: "Apple" },
      searchQueries: [
        {
          id: "q-1",
          text: "AAPL news",
          source: "llm" as const,
          intent: "breaking" as const,
          rank: 1,
          tickerId: "ticker-1",
          setId: "set-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    // Act
    const detail = mapRowToDetailItem(row);

    // Assert
    expect(detail.isActive).toBe("No");
    expect(detail.queries).toHaveLength(1);
    expect(detail.queriesJson).toContain("AAPL news");
    expect(detail.strategySnapshotMarkdown).toContain("queryCount");
  });
});
