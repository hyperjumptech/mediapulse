import { describe, expect, it } from "vitest";

import {
  FALLBACK_TIME_ZONE,
  formatTimeZoneOffset,
  isValidTimeZone,
  resolveTimeZone,
} from "./time-zone";

describe("isValidTimeZone", () => {
  it("accepts IANA zone names", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects unknown zones and non-strings", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("resolveTimeZone", () => {
  it("returns the first valid candidate", () => {
    const timeZone = resolveTimeZone("Mars/Olympus", undefined, "Asia/Jakarta");

    expect(timeZone).toBe("Asia/Jakarta");
  });

  it("falls back to UTC when no candidate is valid", () => {
    expect(resolveTimeZone(null, "")).toBe(FALLBACK_TIME_ZONE);
  });
});

describe("formatTimeZoneOffset", () => {
  it("describes the offset from GMT", () => {
    const offset = formatTimeZoneOffset(
      "Asia/Jakarta",
      new Date("2026-09-28T00:00:00.000Z"),
    );

    expect(offset).toBe("GMT+7");
  });

  it("labels a zero offset as UTC", () => {
    const offset = formatTimeZoneOffset(
      "UTC",
      new Date("2026-09-28T00:00:00.000Z"),
    );

    expect(offset).toBe("UTC");
  });
});
