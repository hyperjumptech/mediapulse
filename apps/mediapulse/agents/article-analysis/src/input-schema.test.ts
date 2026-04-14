/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { articleAnalysisInputSchema } from "./input-schema.js";

describe("articleAnalysisInputSchema", () => {
  it("rejects reanalyze without maxBatchSize or timeWindow bounds", () => {
    const result = articleAnalysisInputSchema.safeParse({
      tickerId: "t1",
      reanalyze: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts reanalyze with maxBatchSize only", () => {
    const result = articleAnalysisInputSchema.safeParse({
      tickerId: "t1",
      reanalyze: true,
      maxBatchSize: 10,
    });
    expect(result.success).toBe(true);
  });

  it("accepts reanalyze with timeWindow start only", () => {
    const result = articleAnalysisInputSchema.safeParse({
      tickerId: "t1",
      reanalyze: true,
      timeWindow: { start: "2026-01-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(true);
  });

  it("allows omitted reanalyze", () => {
    const result = articleAnalysisInputSchema.parse({ tickerId: "t1" });
    expect(result.reanalyze).toBeUndefined();
  });
});
