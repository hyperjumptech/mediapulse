/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { computeNextRunAt } from "./next-run-at";

const schedule = (cronExpression: string, timezone = "Asia/Jakarta") => ({
  repeat: "repeating" as const,
  cronExpression,
  interval: null,
  timezone,
  nextRunAt: null,
});

describe("computeNextRunAt", () => {
  it("reads the expression in the schedule's own timezone", () => {
    const next = computeNextRunAt(
      schedule("0 2 * * *"),
      new Date("2026-09-21T10:00:00.000Z"),
    );

    // 02:00 in Jakarta is 19:00 UTC the day before.
    expect(next?.toISOString()).toBe("2026-09-21T19:00:00.000Z");
  });

  it("returns the next occurrence, never the current instant", () => {
    const now = new Date("2026-09-21T19:00:00.000Z");

    const next = computeNextRunAt(schedule("0 2 * * *"), now);

    expect(next?.getTime()).toBeGreaterThan(now.getTime());
  });

  it("honours a different timezone for the same expression", () => {
    const jakarta = computeNextRunAt(
      schedule("0 2 * * *"),
      new Date("2026-09-21T10:00:00.000Z"),
    );
    const utc = computeNextRunAt(
      schedule("0 2 * * *", "UTC"),
      new Date("2026-09-21T10:00:00.000Z"),
    );

    expect(jakarta?.toISOString()).not.toBe(utc?.toISOString());
  });

  it("returns null for an expression it cannot parse", () => {
    expect(computeNextRunAt(schedule("not a cron"), new Date())).toBeNull();
  });
});
