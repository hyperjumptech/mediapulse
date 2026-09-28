/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { describeScheduleCadence } from "./describe-schedule-cadence";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("describeScheduleCadence", () => {
  it("describes one-off schedules", () => {
    // Act
    const cadence = describeScheduleCadence({
      repeat: "once",
      interval: HOUR,
      cronExpression: null,
    });

    // Assert
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
    // Act
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval,
      cronExpression: null,
    });

    // Assert
    expect(cadence).toEqual({ label: expected, isCronExpression: false });
  });

  it("names the midnight cron preset", () => {
    // Act
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval: null,
      cronExpression: " 0 0 * * * ",
    });

    // Assert
    expect(cadence).toEqual({
      label: "Daily at midnight",
      isCronExpression: false,
    });
  });

  it("returns custom cron expressions verbatim", () => {
    // Act
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval: null,
      cronExpression: "0 7 * * 1-5",
    });

    // Assert
    expect(cadence).toEqual({ label: "0 7 * * 1-5", isCronExpression: true });
  });

  it("falls back when a repeating schedule has no interval or cron", () => {
    // Act
    const cadence = describeScheduleCadence({
      repeat: "repeating",
      interval: 0,
      cronExpression: "  ",
    });

    // Assert
    expect(cadence).toEqual({ label: "Repeating", isCronExpression: false });
  });
});
