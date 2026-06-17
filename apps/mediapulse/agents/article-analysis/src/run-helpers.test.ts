/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  applyMaxBatchSizeCap,
  buildAnalysisGetQuery,
  sortAnalysisDataSourcesByCreatedAt,
} from "./run-helpers.js";

describe("buildAnalysisGetQuery", () => {
  it("maps incremental run to unanalyzed true", () => {
    expect(buildAnalysisGetQuery("tick-a")).toEqual({
      tickerId: "tick-a",
      unanalyzed: true,
    });
  });

  it("omits tickerId for global backlog mode", () => {
    expect(buildAnalysisGetQuery()).toEqual({
      unanalyzed: true,
    });
  });

  it("includes limit when options provide it", () => {
    expect(buildAnalysisGetQuery("tick-d", { limit: 10 })).toEqual({
      tickerId: "tick-d",
      unanalyzed: true,
      limit: 10,
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
