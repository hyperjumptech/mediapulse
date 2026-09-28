import { describe, expect, it } from "vitest";

import { resolveScheduleStartAt } from "./schedule-start-at";

describe("resolveScheduleStartAt", () => {
  it("reads a datetime-local value in the schedule time zone", () => {
    const resolution = resolveScheduleStartAt(
      "2026-09-28T09:00",
      "Asia/Jakarta",
    );

    expect(resolution).toEqual({
      ok: true,
      startAt: new Date("2026-09-28T02:00:00.000Z"),
    });
  });

  it("keeps an instant that carries its own offset", () => {
    const resolution = resolveScheduleStartAt(
      "2026-09-28T09:00:00+02:00",
      "Asia/Jakarta",
    );

    expect(resolution).toEqual({
      ok: true,
      startAt: new Date("2026-09-28T07:00:00.000Z"),
    });
  });

  it("reads a date-only value as midnight in the schedule time zone", () => {
    const resolution = resolveScheduleStartAt("2026-09-28", "Asia/Jakarta");

    expect(resolution).toEqual({
      ok: true,
      startAt: new Date("2026-09-27T17:00:00.000Z"),
    });
  });

  it("passes Date instances through", () => {
    const startAt = new Date("2026-09-28T02:00:00.000Z");

    expect(resolveScheduleStartAt(startAt, "UTC")).toEqual({
      ok: true,
      startAt,
    });
  });

  it("treats an empty value as cleared and leaves undefined untouched", () => {
    expect(resolveScheduleStartAt("", "UTC")).toEqual({
      ok: true,
      startAt: null,
    });
    expect(resolveScheduleStartAt(undefined, "UTC")).toEqual({
      ok: true,
      startAt: undefined,
    });
  });

  it("rejects text that is not a date", () => {
    expect(resolveScheduleStartAt("next tuesday", "UTC")).toEqual({
      ok: false,
    });
  });
});
