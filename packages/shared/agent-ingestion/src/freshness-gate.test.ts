/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { isFresh, isFutureDated } from "./freshness-gate";

describe("isFresh", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("accepts a 5-day-old article when maxAgeDays is 14", () => {
    const publishedAt = new Date("2026-05-16T12:00:00.000Z");

    expect(isFresh(publishedAt, { maxAgeDays: 14 }, now)).toEqual({
      fresh: true,
    });
  });

  it("rejects a 20-day-old article when maxAgeDays is 14", () => {
    const publishedAt = new Date("2026-05-01T12:00:00.000Z");

    expect(isFresh(publishedAt, { maxAgeDays: 14 }, now)).toEqual({
      fresh: false,
      reason: "too_old",
    });
  });

  it("passes null publication dates when allowUnknown is true", () => {
    expect(isFresh(null, { allowUnknown: true }, now)).toEqual({ fresh: true });
  });

  it("rejects null publication dates when allowUnknown is false", () => {
    expect(isFresh(null, { allowUnknown: false }, now)).toEqual({
      fresh: false,
      reason: "unknown_date",
    });
  });

  it("always rejects publication dates more than one day in the future", () => {
    const publishedAt = new Date("2026-05-27T12:00:00.000Z");

    expect(isFresh(publishedAt, { maxAgeDays: 14 }, now)).toEqual({
      fresh: false,
      reason: "future_dated",
    });
  });
});

describe("isFutureDated", () => {
  const now = new Date("2026-08-20T00:00:00Z");

  it("accepts a date inside the one-day clock-skew tolerance", () => {
    expect(isFutureDated(new Date("2026-08-20T18:00:00Z"), now)).toBe(false);
  });

  it("rejects a date beyond the tolerance", () => {
    expect(isFutureDated(new Date("2026-10-01T00:00:00Z"), now)).toBe(true);
  });

  it("accepts a past date whatever its age", () => {
    expect(isFutureDated(new Date("2023-06-23T00:00:00Z"), now)).toBe(false);
  });
});
