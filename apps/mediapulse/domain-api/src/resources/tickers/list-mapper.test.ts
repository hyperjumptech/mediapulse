import type { Ticker } from "@mediapulse/database";
import { describe, expect, it } from "vitest";

import { mapRowToListItem } from "./list-mapper";

describe("mapRowToListItem", () => {
  it("maps the symbol, the name and the timestamps", () => {
    const createdAt = new Date("2024-06-01T12:00:00.000Z");
    const updatedAt = new Date("2024-06-02T12:00:00.000Z");
    const row = {
      id: "t-1",
      symbol: "ABC",
      name: "Alpha",
      createdAt,
      updatedAt,
    } satisfies Ticker;

    const item = mapRowToListItem(row);

    expect(item).toEqual({
      id: "t-1",
      symbol: "ABC",
      name: "Alpha",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });
});
