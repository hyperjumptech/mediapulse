/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { isFresh } from "./freshness-gate";

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
