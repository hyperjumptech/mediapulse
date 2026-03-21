/**
 * Unit tests for tickers list mapping.
 */

/** @vitest-environment node */
import type { Ticker } from "@mediapulse/database";
import { describe, expect, it } from "vitest";
import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("stringifies metadata when present", () => {
    // Setup
    const createdAt = new Date("2024-06-01T12:00:00.000Z");
    const updatedAt = new Date("2024-06-02T12:00:00.000Z");
    const row = {
      id: "t-1",
      symbol: "ABC",
      name: "Alpha",
      metadata: { sector: "Tech" },
      createdAt,
      updatedAt,
    } satisfies Ticker;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item).toEqual({
      id: "t-1",
      symbol: "ABC",
      name: "Alpha",
      metadata: JSON.stringify({ sector: "Tech" }, null, 2),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("uses an empty metadata string when metadata is null", () => {
    // Setup
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const updatedAt = new Date("2024-01-02T00:00:00.000Z");
    const row = {
      id: "t-2",
      symbol: "XYZ",
      name: "Zed",
      metadata: null,
      createdAt,
      updatedAt,
    } satisfies Ticker;

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item.metadata).toBe("");
  });
});
