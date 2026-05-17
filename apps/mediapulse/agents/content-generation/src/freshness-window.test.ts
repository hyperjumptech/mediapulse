/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  computeFreshnessWindow,
  normalizeHour24WallClock,
} from "./freshness-window.js";

describe("normalizeHour24WallClock", () => {
  it("returns inputs unchanged when hour is not 24", () => {
    expect(normalizeHour24WallClock(2026, 4, 20, 0, 30, 0)).toEqual({
      year: 2026,
      month: 4,
      day: 20,
      hour: 0,
      minute: 30,
      second: 0,
    });
  });

  it("rolls end-of-day 24:00:00 to next civil midnight", () => {
    expect(normalizeHour24WallClock(2026, 4, 19, 24, 0, 0)).toEqual({
      year: 2026,
      month: 4,
      day: 20,
      hour: 0,
      minute: 0,
      second: 0,
    });
  });

  it("maps invalid 24:mm:ss with non-zero minutes to 00:mm:ss same day", () => {
    expect(normalizeHour24WallClock(2026, 4, 20, 24, 30, 0)).toEqual({
      year: 2026,
      month: 4,
      day: 20,
      hour: 0,
      minute: 30,
      second: 0,
    });
  });

  it("maps invalid 24:00:ss with non-zero seconds to 00:00:ss same day", () => {
    expect(normalizeHour24WallClock(2026, 4, 20, 24, 0, 1)).toEqual({
      year: 2026,
      month: 4,
      day: 20,
      hour: 0,
      minute: 0,
      second: 1,
    });
  });
});

describe("computeFreshnessWindow", () => {
  it("returns correct window for Asia/Jakarta (UTC+7)", () => {
    // 2026-04-20T10:00:00.000Z = 2026-04-20T17:00:00 in Jakarta
    const now = new Date("2026-04-20T10:00:00.000Z");
    const result = computeFreshnessWindow("Asia/Jakarta", now);

    // Jakarta is UTC+7, so start of day is 2026-04-19T17:00:00.000Z
    // and end of day is 2026-04-20T17:00:00.000Z
    expect(result.windowStart).toBe("2026-04-19T17:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-20T17:00:00.000Z");
  });

  it("returns correct window for UTC", () => {
    const now = new Date("2026-04-20T15:30:00.000Z");
    const result = computeFreshnessWindow("UTC", now);

    expect(result.windowStart).toBe("2026-04-20T00:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-21T00:00:00.000Z");
  });

  it("returns correct window for America/New_York (UTC-5 in April, EDT)", () => {
    // 2026-04-20T12:00:00.000Z = 2026-04-20T08:00:00 EDT
    const now = new Date("2026-04-20T12:00:00.000Z");
    const result = computeFreshnessWindow("America/New_York", now);

    // EDT is UTC-4, so start of day is 2026-04-20T04:00:00.000Z
    // and end of day is 2026-04-21T04:00:00.000Z
    expect(result.windowStart).toBe("2026-04-20T04:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-21T04:00:00.000Z");
  });

  it("handles crossing midnight correctly in Jakarta timezone", () => {
    // Just after midnight in Jakarta: 2026-04-20T00:30:00 Jakarta = 2026-04-19T17:30:00Z
    const now = new Date("2026-04-19T17:30:00.000Z");
    const result = computeFreshnessWindow("Asia/Jakarta", now);

    // Start of 2026-04-20 in Jakarta = 2026-04-19T17:00:00Z
    // End of 2026-04-20 in Jakarta = 2026-04-20T17:00:00Z
    expect(result.windowStart).toBe("2026-04-19T17:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-20T17:00:00.000Z");
  });

  it("throws for invalid timezone", () => {
    const now = new Date("2026-04-20T10:00:00.000Z");
    expect(() => computeFreshnessWindow("Invalid/Timezone", now)).toThrow();
  });
});
