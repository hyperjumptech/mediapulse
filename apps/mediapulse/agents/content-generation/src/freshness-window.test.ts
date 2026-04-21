/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeFreshnessWindow } from "./freshness-window.js";

describe("computeFreshnessWindow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct window for Asia/Jakarta (UTC+7)", () => {
    // 2026-04-20T10:00:00.000Z = 2026-04-20T17:00:00 in Jakarta
    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"));

    const result = computeFreshnessWindow("Asia/Jakarta");

    // Jakarta is UTC+7, so start of day is 2026-04-19T17:00:00.000Z
    // and end of day is 2026-04-20T17:00:00.000Z
    expect(result.windowStart).toBe("2026-04-19T17:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-20T17:00:00.000Z");
  });

  it("returns correct window for UTC", () => {
    vi.setSystemTime(new Date("2026-04-20T15:30:00.000Z"));

    const result = computeFreshnessWindow("UTC");

    expect(result.windowStart).toBe("2026-04-20T00:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-21T00:00:00.000Z");
  });

  it("returns correct window for America/New_York (UTC-5 in April, EDT)", () => {
    // 2026-04-20T12:00:00.000Z = 2026-04-20T08:00:00 EDT
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));

    const result = computeFreshnessWindow("America/New_York");

    // EDT is UTC-4, so start of day is 2026-04-20T04:00:00.000Z
    // and end of day is 2026-04-21T04:00:00.000Z
    expect(result.windowStart).toBe("2026-04-20T04:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-21T04:00:00.000Z");
  });

  it("handles crossing midnight correctly in Jakarta timezone", () => {
    // Just after midnight in Jakarta: 2026-04-20T00:30:00 Jakarta = 2026-04-19T17:30:00Z
    vi.setSystemTime(new Date("2026-04-19T17:30:00.000Z"));

    const result = computeFreshnessWindow("Asia/Jakarta");

    // Start of 2026-04-20 in Jakarta = 2026-04-19T17:00:00Z
    // End of 2026-04-20 in Jakarta = 2026-04-20T17:00:00Z
    expect(result.windowStart).toBe("2026-04-19T17:00:00.000Z");
    expect(result.windowEnd).toBe("2026-04-20T17:00:00.000Z");
  });

  it("throws for invalid timezone", () => {
    vi.setSystemTime(new Date("2026-04-20T10:00:00.000Z"));

    expect(() => computeFreshnessWindow("Invalid/Timezone")).toThrow();
  });
});
