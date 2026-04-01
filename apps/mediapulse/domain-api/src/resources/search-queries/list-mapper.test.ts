/**
 * Unit tests for search-queries list mapping and `listInclude`.
 */

/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { mapRowToListItem, type ListRow } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("flattens ticker, set metadata, and intent fields for Hermes table-v1", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const generatedAt = new Date("2024-06-30T12:00:00.000Z");
    const row = {
      id: "sq-1",
      text: "earnings",
      tickerId: "t-9",
      setId: "set-1",
      source: "deterministic",
      intent: "fundamental",
      rank: 2,
      createdAt,
      updatedAt,
      ticker: { symbol: "ACME", name: "Acme Inc" },
      querySet: {
        id: "set-1",
        isActive: true,
        generatedAt,
        generationSource: "hybrid_v1",
        agentJobId: "job-99",
      },
    } satisfies ListRow;

    const item = mapRowToListItem(row);

    expect(item).toEqual({
      id: "sq-1",
      text: "earnings",
      tickerSymbol: "ACME",
      tickerName: "Acme Inc",
      activeSet: "Yes",
      intent: "fundamental",
      rank: "2",
      source: "deterministic",
      setGeneratedAt: generatedAt.toISOString(),
      generationPipeline: "hybrid_v1",
      querySetId: "set-1",
      agentJobId: "job-99",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("treats legacy rows without a set as active for dashboard labeling", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const row = {
      id: "sq-legacy",
      text: "legacy query",
      tickerId: "t-9",
      setId: null,
      source: "deterministic",
      intent: "breaking",
      rank: 0,
      createdAt,
      updatedAt,
      ticker: { symbol: "LEG", name: "Legacy Co" },
      querySet: null,
    } satisfies ListRow;

    const item = mapRowToListItem(row);

    expect(item.activeSet).toBe("Yes");
    expect(item.querySetId).toBe("");
    expect(item.agentJobId).toBe("");
    expect(item.setGeneratedAt).toBe(createdAt.toISOString());
  });

  it("marks inactive set rows as No when a set exists but is not active", () => {
    const createdAt = new Date("2024-07-01T00:00:00.000Z");
    const updatedAt = new Date("2024-07-02T00:00:00.000Z");
    const generatedAt = new Date("2024-06-30T12:00:00.000Z");
    const row = {
      id: "sq-old",
      text: "old",
      tickerId: "t-9",
      setId: "set-old",
      source: "llm",
      intent: "kg_change",
      rank: 1,
      createdAt,
      updatedAt,
      ticker: { symbol: "OLD", name: "Old Inc" },
      querySet: {
        id: "set-old",
        isActive: false,
        generatedAt,
        generationSource: "hybrid_v1",
        agentJobId: null,
      },
    } satisfies ListRow;

    const item = mapRowToListItem(row);

    expect(item.activeSet).toBe("No");
  });
});
