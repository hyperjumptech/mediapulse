/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { computeStartupJitterMs } from "./startup-jitter";

describe("computeStartupJitterMs", () => {
  it("returns a delay within [0, maxJitterMs)", () => {
    expect(computeStartupJitterMs(30_000, () => 0)).toBe(0);
    expect(computeStartupJitterMs(30_000, () => 0.5)).toBe(15_000);
    expect(computeStartupJitterMs(30_000, () => 0.999999)).toBeLessThan(30_000);
  });

  it("returns 0 when jitter is disabled or invalid", () => {
    expect(computeStartupJitterMs(0, () => 0.9)).toBe(0);
    expect(computeStartupJitterMs(-1000, () => 0.9)).toBe(0);
    expect(computeStartupJitterMs(Number.NaN, () => 0.9)).toBe(0);
  });
});
