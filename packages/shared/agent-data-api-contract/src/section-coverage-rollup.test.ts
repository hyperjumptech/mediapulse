/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  getSectionCoverageRollupQuerySchema,
  getSectionCoverageRollupResponseSchema,
} from "./section-coverage-rollup.js";

describe("getSectionCoverageRollupQuerySchema", () => {
  it("defaults windowDays to 30", () => {
    const parsed = getSectionCoverageRollupQuerySchema.parse({
      tickerId: "ticker-1",
    });

    expect(parsed.windowDays).toBe(30);
  });

  it("rejects empty tickerId", () => {
    const result = getSectionCoverageRollupQuerySchema.safeParse({
      tickerId: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("getSectionCoverageRollupResponseSchema", () => {
  it("accepts per-version rollup rows", () => {
    const parsed = getSectionCoverageRollupResponseSchema.parse({
      byVersion: [
        {
          contractVersion: null,
          coverageRunCount: 2,
          fillRunCount: 1,
          bySection: {
            industryPulse: { avgCoverage: 1.5, avgFill: 2 },
          },
        },
      ],
    });

    expect(parsed.byVersion[0]?.contractVersion).toBeNull();
  });
});
