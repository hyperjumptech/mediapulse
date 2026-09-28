import { describe, expect, it } from "vitest";

import { buildTrailingDayKeys, formatDayKey, toDayKey } from "./day-key";

describe("toDayKey", () => {
  it("uses the calendar day in the given time zone", () => {
    const instant = new Date("2026-09-27T20:00:00.000Z");

    expect(toDayKey(instant, "UTC")).toBe("2026-09-27");
    expect(toDayKey(instant, "Asia/Jakarta")).toBe("2026-09-28");
  });
});

describe("buildTrailingDayKeys", () => {
  it("lists consecutive days ending on the given day", () => {
    expect(buildTrailingDayKeys("2026-03-02", 3)).toEqual([
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });
});

describe("formatDayKey", () => {
  it("renders a short month and day without shifting the date", () => {
    expect(formatDayKey("2026-09-28")).toBe("Sep 28");
  });
});
