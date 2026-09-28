import { describe, expect, it } from "vitest";

import {
  buildCountTrend,
  buildRateTrend,
  formatPercent,
  successRate,
} from "./overview-trends";

const counts = (overrides: Partial<Record<string, number>> = {}) => ({
  total: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
  ...overrides,
});

describe("buildCountTrend", () => {
  it("reports the percentage change from the previous window", () => {
    expect(buildCountTrend(120, 100)).toEqual({
      direction: "up",
      label: "+20%",
    });
    expect(buildCountTrend(75, 100)).toEqual({
      direction: "down",
      label: "-25%",
    });
  });

  it("does not divide by zero when the previous window was empty", () => {
    expect(buildCountTrend(3, 0)).toEqual({ direction: "up", label: "new" });
    expect(buildCountTrend(0, 0)).toEqual({ direction: "flat", label: "0%" });
  });
});

describe("successRate", () => {
  it("ignores runs that have not finished", () => {
    expect(successRate(counts({ succeeded: 9, failed: 1, running: 5 }))).toBe(
      90,
    );
  });

  it("returns null when nothing finished", () => {
    expect(successRate(counts({ running: 2 }))).toBeNull();
  });
});

describe("buildRateTrend", () => {
  it("reports the change in percentage points", () => {
    expect(buildRateTrend(97.5, 99)).toEqual({
      direction: "down",
      label: "-1.5 pts",
    });
  });

  it("returns null without a rate on both sides", () => {
    expect(buildRateTrend(90, null)).toBeNull();
  });
});

describe("formatPercent", () => {
  it("rounds to one decimal and uses a dash for missing values", () => {
    expect(formatPercent(97.25)).toBe("97.3%");
    expect(formatPercent(null)).toBe("—");
  });
});
