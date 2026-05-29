import { describe, expect, it } from "vitest";

import { formatActivityDuration } from "./format-activity-duration";

describe("formatActivityDuration", () => {
  it("returns < 1s for sub-second durations", () => {
    expect(formatActivityDuration(0)).toBe("< 1s");
    expect(formatActivityDuration(999)).toBe("< 1s");
  });

  it("returns seconds under one minute", () => {
    expect(formatActivityDuration(1000)).toBe("1s");
    expect(formatActivityDuration(45_000)).toBe("45s");
    expect(formatActivityDuration(59_999)).toBe("59s");
  });

  it("returns minutes and seconds under one hour", () => {
    expect(formatActivityDuration(60_000)).toBe("1m");
    expect(formatActivityDuration(83_000)).toBe("1m 23s");
    expect(formatActivityDuration(3_599_999)).toBe("59m 59s");
  });

  it("returns hours and minutes for one hour or more", () => {
    expect(formatActivityDuration(3_661_000)).toBe("1h 1m");
    expect(formatActivityDuration(7_440_000)).toBe("2h 4m");
    expect(formatActivityDuration(3_600_000)).toBe("1h");
  });
});
