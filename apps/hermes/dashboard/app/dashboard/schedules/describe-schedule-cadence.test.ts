/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { describeScheduleCadence } from "./describe-schedule-cadence";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("describeScheduleCadence", () => {
  it("describes one-off schedules", () => {
    const cadence = describeScheduleCadence({
      repeat: "once",
      interval: HOUR,
      cronExpression: null,
    });

    expect(cadence).toEqual({ label: "Once", isCronExpression: false });
  });

  it.each([
    [HOUR, "Hourly"],
    [24 * HOUR, "Daily"],
    [15 * MINUTE, "Every 15m"],
    [6 * HOUR, "Every 6h"],
    [48 * HOUR, "Every 2d"],
    [90 * MINUTE, "Every 90m"],
    [10_000, "Every 1m"],
  ])("describes a %d ms interval as %s", (interval, expected) => {
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval,
      cronExpression: null,
    });

    expect(cadence).toEqual({ label: expected, isCronExpression: false });
  });

  it("names the midnight cron preset", () => {
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval: null,
      cronExpression: " 0 0 * * * ",
    });

    expect(cadence).toEqual({
      label: "Daily at midnight",
      isCronExpression: false,
    });
  });

  it.each([
    ["0 2 * * *", "Daily at 02:00"],
    ["30 7 * * 1-5", "Weekdays at 07:30"],
    ["15 9 * * 1", "Every Mon at 09:15"],
    ["5 * * * *", "Hourly at :05"],
  ])("puts the common cron %s into words", (cronExpression, label) => {
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval: null,
      cronExpression,
    });

    expect(cadence).toEqual({ label, isCronExpression: false });
  });

  it.each(["0 7 1 * *", "*/15 * * * *", "0 25 * * *", "0 7 * * 1,3"])(
    "returns the cron %s verbatim when it has no plain wording",
    (cronExpression) => {
      const cadence = describeScheduleCadence({
        repeat: "repeating",
        interval: null,
        cronExpression,
      });

      expect(cadence).toEqual({
        label: cronExpression,
        isCronExpression: true,
      });
    },
  );

  it("falls back when a repeating schedule has no interval or cron", () => {
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval: 0,
      cronExpression: "  ",
    });

    expect(cadence).toEqual({ label: "Repeating", isCronExpression: false });
  });
});
