/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { mapRowToListItem, type StorylineListRow } from "./list-mapper";

const baseRow = {
  id: "s1",
  name: "Contract delay",
  kind: "story",
  locked: false,
  lockedReason: null,
  lockedAt: null,
  firstObservedAt: new Date("2026-03-02T00:00:00.000Z"),
  lastObservedAt: new Date("2026-04-18T00:00:00.000Z"),
  createdAt: new Date("2026-03-02T00:00:00.000Z"),
  updatedAt: new Date("2026-04-18T00:00:00.000Z"),
  _count: { developments: 12, tickers: 2 },
  tickers: [{ ticker: { symbol: "FORE" } }, { ticker: { symbol: "BBCA" } }],
} as unknown as StorylineListRow;

describe("mapRowToListItem", () => {
  it("maps the row and carries the injected citation count", () => {
    const item = mapRowToListItem(baseRow, 31);

    expect(item.id).toBe("s1");
    expect(item.kindLabel).toBe("Story");
    expect(item.lockedLabel).toBe("Open");
    expect(item.developmentCount).toBe(12);
    expect(item.citationCount).toBe(31);
    expect(item.tickerCount).toBe(2);
  });

  it("joins the ticker symbols it fetched", () => {
    expect(mapRowToListItem(baseRow, 0).tickerSymbols).toBe("FORE, BBCA");
  });

  it("marks tickers beyond the chip cap as an overflow count", () => {
    const row = {
      ...baseRow,
      _count: { developments: 1, tickers: 9 },
    } as unknown as StorylineListRow;

    expect(mapRowToListItem(row, 0).tickerSymbols).toBe("FORE, BBCA +7");
  });

  it("renders an em dash when no ticker is linked", () => {
    const row = {
      ...baseRow,
      tickers: [],
      _count: { developments: 1, tickers: 0 },
    } as unknown as StorylineListRow;

    expect(mapRowToListItem(row, 0).tickerSymbols).toBe("—");
  });

  it("serializes both observation bounds as ISO strings", () => {
    const item = mapRowToListItem(baseRow, 0);

    expect(item.firstObservedAt).toBe("2026-03-02T00:00:00.000Z");
    expect(item.lastObservedAt).toBe("2026-04-18T00:00:00.000Z");
  });

  it("labels a locked format storyline", () => {
    const row = {
      ...baseRow,
      kind: "format",
      locked: true,
    } as unknown as StorylineListRow;
    const item = mapRowToListItem(row, 0);

    expect(item.kindLabel).toBe("Format");
    expect(item.lockedLabel).toBe("Locked");
  });
});
