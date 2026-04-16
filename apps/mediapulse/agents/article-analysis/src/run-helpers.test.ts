/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { ArticleAnalysisInput } from "./input-schema.js";
import { articleAnalysisInputSchema } from "./input-schema.js";
import {
  applyMaxBatchSizeCap,
  buildAnalysisGetQuery,
  sortAnalysisDataSourcesByCreatedAt,
} from "./run-helpers.js";

describe("buildAnalysisGetQuery", () => {
  it("maps incremental run to unanalyzed true", () => {
    const input = articleAnalysisInputSchema.parse({
      tickerId: "tick-a",
    });
    expect(buildAnalysisGetQuery(input)).toEqual({
      tickerId: "tick-a",
      unanalyzed: true,
    });
  });

  it("maps reanalyze to unanalyzed false", () => {
    const input = articleAnalysisInputSchema.parse({
      tickerId: "tick-b",
      reanalyze: true,
      maxBatchSize: 5,
    });
    expect(buildAnalysisGetQuery(input)).toEqual({
      tickerId: "tick-b",
      unanalyzed: false,
    });
  });

  it("forwards timeWindow start and end", () => {
    const input: ArticleAnalysisInput = {
      tickerId: "tick-c",
      reanalyze: false,
      timeWindow: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-01-31T00:00:00.000Z",
      },
    };
    expect(buildAnalysisGetQuery(input)).toEqual({
      tickerId: "tick-c",
      unanalyzed: true,
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-31T00:00:00.000Z",
    });
  });
});

describe("sortAnalysisDataSourcesByCreatedAt", () => {
  it("sorts by createdAt then id", () => {
    const rows = [
      {
        id: "b",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        id: "a",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "c",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    const sorted = sortAnalysisDataSourcesByCreatedAt(rows);
    expect(sorted.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });
});

describe("applyMaxBatchSizeCap", () => {
  it("returns full copy when maxBatchSize is omitted", () => {
    const sorted = [1, 2];
    expect(applyMaxBatchSizeCap(sorted)).toEqual([1, 2]);
  });

  it("truncates to first N items", () => {
    const sorted = ["a", "b", "c"];
    expect(applyMaxBatchSizeCap(sorted, 2)).toEqual(["a", "b"]);
  });
});
