/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("maps ticker, counts, and timestamps", () => {
    // Setup
    const row = {
      id: "set-1",
      tickerId: "ticker-1",
      generatedAt: new Date("2026-03-20T12:00:00.000Z"),
      isActive: true,
      strategySnapshot: {},
      generationSource: "manual",
      agentJobId: "job-1",
      createdAt: new Date("2026-03-20T11:00:00.000Z"),
      updatedAt: new Date("2026-03-20T12:30:00.000Z"),
      ticker: { symbol: "AAPL", name: "Apple Inc." },
      _count: { searchQueries: 3 },
    };

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item.tickerSymbol).toBe("AAPL");
    expect(item.isActive).toBe("Yes");
    expect(item.queryCount).toBe("3");
    expect(item.agentJobId).toBe("job-1");
  });
});
