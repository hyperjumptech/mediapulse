import { describe, expect, it } from "vitest";

import { formatCompactDuration, isDurationUnit } from "./format-duration";

describe("isDurationUnit", () => {
  it("returns true for ms", () => {
    expect(isDurationUnit("ms")).toBe(true);
  });

  it("returns false for other units", () => {
    expect(isDurationUnit("s")).toBe(false);
    expect(isDurationUnit("req")).toBe(false);
    expect(isDurationUnit("%")).toBe(false);
  });

  it("returns false when unit is undefined", () => {
    expect(isDurationUnit(undefined)).toBe(false);
  });
});

describe("formatCompactDuration", () => {
  it("returns 0 ms for zero", () => {
    expect(formatCompactDuration(0)).toBe("0 ms");
  });

  it("sub-second band: formats as ms", () => {
    expect(formatCompactDuration(1)).toBe("1 ms");
    expect(formatCompactDuration(850)).toBe("850 ms");
    expect(formatCompactDuration(999)).toBe("999 ms");
  });

  it("exact threshold 999 stays sub-second", () => {
    expect(formatCompactDuration(999)).toBe("999 ms");
  });

  it("exact threshold 1000 enters seconds band", () => {
    expect(formatCompactDuration(1000)).toBe("1s");
  });

  it("seconds band: one decimal for values under 10s", () => {
    expect(formatCompactDuration(5200)).toBe("5.2s");
    expect(formatCompactDuration(1500)).toBe("1.5s");
  });

  it("seconds band: whole seconds for values >= 10s", () => {
    expect(formatCompactDuration(10_000)).toBe("10s");
    expect(formatCompactDuration(23_000)).toBe("23s");
  });

  it("exact threshold 59999 stays in seconds band", () => {
    expect(formatCompactDuration(59_999)).toBe("60s");
  });

  it("exact threshold 60000 enters minutes band", () => {
    expect(formatCompactDuration(60_000)).toBe("1m");
  });

  it("minutes band: includes seconds when non-zero", () => {
    expect(formatCompactDuration(150_000)).toBe("2m 30s");
    expect(formatCompactDuration(90_000)).toBe("1m 30s");
  });

  it("minutes band: drops 0s", () => {
    expect(formatCompactDuration(300_000)).toBe("5m");
  });

  it("exact threshold 3599999 stays in minutes band", () => {
    expect(formatCompactDuration(3_599_999)).toBe("60m");
  });

  it("exact threshold 3600000 enters hours band", () => {
    expect(formatCompactDuration(3_600_000)).toBe("1h");
  });

  it("hours band: includes minutes when non-zero", () => {
    expect(formatCompactDuration(3_900_000)).toBe("1h 5m");
    expect(formatCompactDuration(7_500_000)).toBe("2h 5m");
  });

  it("hours band: drops 0m", () => {
    expect(formatCompactDuration(7_200_000)).toBe("2h");
  });

  it("negative values: leading minus sign with same magnitude rules", () => {
    expect(formatCompactDuration(-500)).toBe("−500 ms");
    expect(formatCompactDuration(-5200)).toBe("−5.2s");
    expect(formatCompactDuration(-23_000)).toBe("−23s");
    expect(formatCompactDuration(-150_000)).toBe("−2m 30s");
    expect(formatCompactDuration(-3_900_000)).toBe("−1h 5m");
  });
});
