import { describe, expect, it } from "vitest";

import {
  EMPTY_DATE_TIME_LABEL,
  formatDateTime,
  toValidDate,
} from "./format-date-time";

const now = new Date("2026-09-28T12:00:00.000Z");

describe("formatDateTime", () => {
  it("formats a UTC instant in Asia/Jakarta", () => {
    const label = formatDateTime("2026-09-28T07:55:00.000Z", {
      timeZone: "Asia/Jakarta",
      now,
    });

    expect(label).toBe("Sep 28, 2026, 14:55");
  });

  it("formats the same instant differently per time zone", () => {
    const instant = "2026-09-28T02:30:00.000Z";

    const jakartaLabel = formatDateTime(instant, {
      timeZone: "Asia/Jakarta",
      style: "date",
    });
    const newYorkLabel = formatDateTime(instant, {
      timeZone: "America/New_York",
      style: "date",
    });

    expect(jakartaLabel).toBe("Sep 28, 2026");
    expect(newYorkLabel).toBe("Sep 27, 2026");
  });

  it("follows daylight saving time in New York", () => {
    const summerLabel = formatDateTime("2026-07-01T16:00:00.000Z", {
      timeZone: "America/New_York",
      style: "time",
    });
    const winterLabel = formatDateTime("2026-01-15T16:00:00.000Z", {
      timeZone: "America/New_York",
      style: "time",
    });

    expect(summerLabel).toBe("12:00");
    expect(winterLabel).toBe("11:00");
  });

  it("renders midnight as 00 rather than 24", () => {
    const label = formatDateTime("2026-09-28T00:00:00.000Z", {
      timeZone: "UTC",
      style: "time",
    });

    expect(label).toBe("00:00");
  });

  it("omits the year in compact style only within the current year", () => {
    const sameYear = formatDateTime("2026-03-01T10:00:00.000Z", {
      timeZone: "UTC",
      style: "compact",
      now,
    });
    const otherYear = formatDateTime("2025-03-01T10:00:00.000Z", {
      timeZone: "UTC",
      style: "compact",
      now,
    });

    expect(sameYear).toBe("Mar 1, 10:00");
    expect(otherYear).toBe("Mar 1, 2025, 10:00");
  });

  it("accepts Date, string and epoch number input", () => {
    const expected = "Sep 28, 2026, 07:55";
    const instant = Date.parse("2026-09-28T07:55:00.000Z");

    expect(formatDateTime(new Date(instant), { timeZone: "UTC" })).toBe(
      expected,
    );
    expect(
      formatDateTime("2026-09-28T07:55:00.000Z", { timeZone: "UTC" }),
    ).toBe(expected);
    expect(formatDateTime(instant, { timeZone: "UTC" })).toBe(expected);
  });

  it("renders a dash for missing or invalid values", () => {
    expect(formatDateTime(null, { timeZone: "UTC" })).toBe(
      EMPTY_DATE_TIME_LABEL,
    );
    expect(formatDateTime("", { timeZone: "UTC" })).toBe(EMPTY_DATE_TIME_LABEL);
    expect(formatDateTime("not-a-date", { timeZone: "UTC" })).toBe(
      EMPTY_DATE_TIME_LABEL,
    );
  });
});

describe("toValidDate", () => {
  it("returns null for values that are not dates", () => {
    expect(toValidDate({})).toBeNull();
    expect(toValidDate(true)).toBeNull();
    expect(toValidDate(new Date("invalid"))).toBeNull();
  });
});
