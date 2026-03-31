/**
 * Unit tests for search-queries list mapping and `listInclude`.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { mapRowToListItem, type ListRow } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("flattens ticker symbol and name", () => {
    // Setup
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "sq-1",
      text: "earnings",
      tickerId: "t-9",
      intent: "test-intent",
      rank: 1,
      source: "test-source",
      setId: null,
      set: null,
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
    } satisfies ListRow;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item).toEqual({
      id: "sq-1",
      text: "earnings",
      tickerSymbol: "ACME",
      tickerName: "Acme Inc",
      activeSet: "No",
      intent: "test-intent",
      rank: "1",
      source: "test-source",
      setGeneratedAt: "",
      generationPipeline: "",
      querySetId: "",
      agentJobId: "",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });
});
