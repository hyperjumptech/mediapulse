/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { computeNextRunAt, type ScheduleForNextRun } from "./next-run-at";

describe("computeNextRunAt", () => {
  it("returns null for once repeat", () => {
    const schedule: ScheduleForNextRun = {
      repeat: "once",
      cronExpression: "0 6 * * *",
      interval: null,
      timezone: "UTC",
      nextRunAt: null,
    };

    const result = computeNextRunAt(schedule, new Date("2024-06-01T00:00:00Z"));

    expect(result).toBeNull();
  });

  it("returns next run for repeating cron when parser succeeds", () => {
    const schedule: ScheduleForNextRun = {
      repeat: "repeating",
      cronExpression: "0 6 * * *",
      interval: null,
      timezone: "UTC",
      nextRunAt: null,
    };
    const after = new Date("2024-06-01T00:00:00Z");

    const result = computeNextRunAt(schedule, after);

    if (result !== null) {
      expect(result.getUTCHours()).toBe(6);
      expect(result.getUTCDate()).toBe(1);
    }
  });

  it("returns next run for repeating interval", () => {
    const schedule: ScheduleForNextRun = {
      repeat: "repeating",
      cronExpression: null,
      interval: 3600000,
      timezone: "UTC",
      nextRunAt: new Date("2024-06-01T10:00:00Z"),
    };
    const after = new Date("2024-06-01T09:00:00Z");

    const result = computeNextRunAt(schedule, after);

    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(new Date("2024-06-01T11:00:00Z").getTime());
  });
});
