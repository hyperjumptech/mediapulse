import { describe, expect, it } from "vitest";

import {
  formatDay1SkipReason,
  mapRowToDetailItem,
  mapRowToListItem,
  type Day1DispatchRow,
} from "./list-mapper";

const row = {
  id: "dispatch-1",
  userTickerId: "ut-1",
  tickerId: "ticker-1",
  language: "id",
  kind: "none",
  status: "skipped",
  reason: "missing_translation",
  hermesExecutionId: null,
  error: null,
  createdAt: new Date("2026-09-29T08:00:00.000Z"),
  updatedAt: new Date("2026-09-29T08:00:01.000Z"),
  ticker: { symbol: "BBCA" },
  userTicker: { userId: "user-1", user: { email: "reader@example.com" } },
} as unknown as Day1DispatchRow;

describe("mapRowToListItem", () => {
  it("maps enum values to readable labels", () => {
    expect(mapRowToListItem(row)).toEqual({
      id: "dispatch-1",
      createdAt: "2026-09-29T08:00:00.000Z",
      tickerSymbol: "BBCA",
      subscriberEmail: "reader@example.com",
      kind: "None",
      status: "Skipped",
      reason: "Latest issue has no translation for this language",
      language: "Indonesian",
    });
  });
});

describe("mapRowToDetailItem", () => {
  it("adds the title, the user id for linking and the Hermes fields", () => {
    const detail = mapRowToDetailItem({
      ...row,
      kind: "bootstrap",
      status: "fired",
      reason: null,
      hermesExecutionId: "exec-1",
    } as Day1DispatchRow);

    expect(detail).toMatchObject({
      title: "BBCA · reader@example.com",
      kind: "Full chain",
      status: "Fired",
      reason: null,
      userId: "user-1",
      tickerId: "ticker-1",
      hermesExecutionId: "exec-1",
      updatedAt: "2026-09-29T08:00:01.000Z",
    });
  });
});

describe("formatDay1SkipReason", () => {
  it("keeps an unknown reason as it is", () => {
    expect(formatDay1SkipReason("something_new")).toBe("something_new");
    expect(formatDay1SkipReason(null)).toBeNull();
  });
});
