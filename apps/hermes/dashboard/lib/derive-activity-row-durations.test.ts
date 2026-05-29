import { describe, expect, it } from "vitest";

import { attachActivityRowDurations } from "./derive-activity-row-durations";

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
