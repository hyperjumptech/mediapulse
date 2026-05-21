/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { articleAnalysisInputSchema } from "./article-analysis-input-schema.js";

describe("articleAnalysisInputSchema", () => {
  it("accepts tickerId only", () => {
    const result = articleAnalysisInputSchema.safeParse({
      tickerId: "t1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ tickerId: "t1" });
    }
  });

  it("rejects reanalyze as an unknown field", () => {
    const result = articleAnalysisInputSchema.safeParse({
      tickerId: "t1",
      reanalyze: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/unrecognized/i);
    }
  });

  it("rejects timeWindow as an unknown field", () => {
    const result = articleAnalysisInputSchema.safeParse({
      tickerId: "t1",
      timeWindow: { start: "2026-01-01T00:00:00.000Z" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/unrecognized/i);
    }
  });

  it("rejects maxBatchSize as an unknown field", () => {
    const result = articleAnalysisInputSchema.safeParse({
      tickerId: "t1",
      maxBatchSize: 5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/unrecognized/i);
    }
  });
});
