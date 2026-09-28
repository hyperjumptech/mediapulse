import { describe, expect, it } from "vitest";

import { utcToWallTime, wallTimeToUtc } from "./zoned-wall-time";

describe("wallTimeToUtc", () => {
  it("reads a wall-clock time in Asia/Jakarta", () => {
    const instant = wallTimeToUtc("2026-09-28T14:55", "Asia/Jakarta");

    expect(instant?.toISOString()).toBe("2026-09-28T07:55:00.000Z");
  });

  it("uses the daylight saving offset in effect on that date", () => {
    const summer = wallTimeToUtc("2026-07-01T09:00", "America/New_York");
    const winter = wallTimeToUtc("2026-01-15T09:00", "America/New_York");

    expect(summer?.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(winter?.toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("accepts seconds", () => {
    const instant = wallTimeToUtc("2026-09-28T00:00:30", "UTC");

    expect(instant?.toISOString()).toBe("2026-09-28T00:00:30.000Z");
  });

  it("returns null for text that is not a wall-clock time", () => {
    expect(wallTimeToUtc("tomorrow", "UTC")).toBeNull();
    expect(wallTimeToUtc("2026-09-28T07:55:00Z", "UTC")).toBeNull();
  });
});

describe("utcToWallTime", () => {
  it("renders an instant as a datetime-local value in the zone", () => {
    const wallTime = utcToWallTime(
      new Date("2026-09-28T07:55:00.000Z"),
      "Asia/Jakarta",
    );

    expect(wallTime).toBe("2026-09-28T14:55");
  });

  it("round-trips with wallTimeToUtc", () => {
    const instant = "2026-03-08T12:30:00.000Z";

    const wallTime = utcToWallTime(instant, "America/New_York");
    const roundTrip = wallTimeToUtc(wallTime, "America/New_York");

    expect(roundTrip?.toISOString()).toBe(instant);
  });

  it("returns an empty string for an invalid instant", () => {
    expect(utcToWallTime("nope", "UTC")).toBe("");
  });
});
