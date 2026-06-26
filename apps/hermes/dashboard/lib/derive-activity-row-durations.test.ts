import { describe, expect, it } from "vitest";

import {
  attachActivityRowDurations,
  isActivityRowInProgress,
} from "./derive-activity-row-durations";

describe("isActivityRowInProgress", () => {
  it("treats superseded processing rows as completed in the UI", () => {
    const row = {
      status: "processing" as const,
    };

    expect(isActivityRowInProgress(row, 0, 3, true)).toBe(false);
    expect(isActivityRowInProgress(row, 1, 3, true)).toBe(false);
    expect(isActivityRowInProgress(row, 2, 3, true)).toBe(true);
  });

  it("returns false for the last row when the run is completed", () => {
    expect(isActivityRowInProgress({ status: "completed" }, 2, 3, true)).toBe(
      false,
    );
  });

  it("returns false for a stuck processing last row when the job is terminal", () => {
    expect(isActivityRowInProgress({ status: "processing" }, 2, 3, false)).toBe(
      false,
    );
  });
});

describe("attachActivityRowDurations", () => {
  it("diffs consecutive rows and uses total fallback for last completed row", () => {
    const rows = attachActivityRowDurations([
      {
        id: "1",
        title: "Step one",
        description: null,
        status: "processing",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        title: "Step two",
        description: null,
        status: "processing",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      {
        id: "3",
        title: "Step three",
        description: null,
        status: "completed",
        createdAt: "2026-01-01T00:03:30.000Z",
      },
    ]);

    expect(rows[0]?.durationMs).toBe(60_000);
    expect(rows[1]?.durationMs).toBe(150_000);
    expect(rows[2]?.durationMs).toBe(210_000);
  });

  it("sets null duration for the last processing row", () => {
    const rows = attachActivityRowDurations([
      {
        id: "1",
        title: "Step one",
        description: null,
        status: "completed",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "2",
        title: "Step two",
        description: null,
        status: "processing",
        createdAt: "2026-01-01T00:00:45.000Z",
      },
    ]);

    expect(rows[0]?.durationMs).toBe(45_000);
    expect(rows[1]?.durationMs).toBeNull();
  });
});
