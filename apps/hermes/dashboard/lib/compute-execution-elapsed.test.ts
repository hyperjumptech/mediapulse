/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  computeJobElapsedDisplay,
  computeJobElapsedMs,
  computePipelineWallElapsed,
  formatElapsedMs,
  formatJobElapsedCell,
  formatPipelineElapsedLabel,
} from "./compute-execution-elapsed";

describe("formatElapsedMs", () => {
  it("formats sub-second as less than one second", () => {
    expect(formatElapsedMs(0)).toBe("<1s");
    expect(formatElapsedMs(500)).toBe("<1s");
    expect(formatElapsedMs(999)).toBe("<1s");
  });

  it("formats seconds under one minute", () => {
    expect(formatElapsedMs(1000)).toBe("1s");
    expect(formatElapsedMs(45_000)).toBe("45s");
    expect(formatElapsedMs(59_999)).toBe("59s");
  });

  it("formats minutes under one hour", () => {
    expect(formatElapsedMs(60_000)).toBe("1m");
    expect(formatElapsedMs(125_000)).toBe("2m 5s");
    expect(formatElapsedMs(3_599_000)).toBe("59m 59s");
  });

  it("formats hours", () => {
    expect(formatElapsedMs(3_600_000)).toBe("1h");
    expect(formatElapsedMs(3_660_000)).toBe("1h 1m");
  });

  it("treats negative ms as zero", () => {
    expect(formatElapsedMs(-100)).toBe("0s");
  });
});

describe("computeJobElapsedMs", () => {
  it("returns null when either timestamp is missing", () => {
    const a = new Date("2026-01-01T00:00:00.000Z");
    const b = new Date("2026-01-01T00:00:05.000Z");
    expect(computeJobElapsedMs(null, b)).toBeNull();
    expect(computeJobElapsedMs(a, null)).toBeNull();
    expect(computeJobElapsedMs(null, null)).toBeNull();
  });

  it("returns difference in ms when valid", () => {
    const a = new Date("2026-01-01T00:00:00.000Z");
    const b = new Date("2026-01-01T00:00:05.000Z");
    expect(computeJobElapsedMs(a, b)).toBe(5000);
  });

  it("returns null when completed is before started", () => {
    const a = new Date("2026-01-01T00:00:05.000Z");
    const b = new Date("2026-01-01T00:00:00.000Z");
    expect(computeJobElapsedMs(a, b)).toBeNull();
  });
});

describe("computeJobElapsedDisplay", () => {
  it("returns final when both timestamps exist", () => {
    const a = new Date("2026-01-01T00:00:00.000Z");
    const b = new Date("2026-01-01T00:00:03.000Z");
    const r = computeJobElapsedDisplay(a, b);
    expect(r).toEqual({ kind: "final", ms: 3000 });
  });

  it("returns in_progress when only started is set", () => {
    const a = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:01:00.000Z");
    const r = computeJobElapsedDisplay(a, null, now);
    expect(r).toEqual({ kind: "in_progress", ms: 60_000 });
  });

  it("returns unknown when no started and no completed", () => {
    expect(computeJobElapsedDisplay(null, null)).toEqual({ kind: "unknown" });
  });

  it("returns unknown when started is in the future relative to now", () => {
    const future = new Date("2099-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(computeJobElapsedDisplay(future, null, now)).toEqual({
      kind: "unknown",
    });
  });
});

describe("formatJobElapsedCell", () => {
  it("formats unknown as em dash", () => {
    expect(formatJobElapsedCell({ kind: "unknown" })).toBe("—");
  });

  it("formats final with formatElapsedMs", () => {
    expect(formatJobElapsedCell({ kind: "final", ms: 5000 })).toBe("5s");
  });

  it("formats in_progress with suffix", () => {
    expect(formatJobElapsedCell({ kind: "in_progress", ms: 60_000 })).toBe(
      "1m (so far)",
    );
  });
});

describe("computePipelineWallElapsed", () => {
  const t0 = new Date("2026-01-01T00:00:00.000Z");
  const t1 = new Date("2026-01-01T00:00:10.000Z");
  const t2 = new Date("2026-01-01T00:01:00.000Z");

  it("returns unknown for empty invocations", () => {
    expect(computePipelineWallElapsed([], "succeeded")).toEqual({
      kind: "unknown",
    });
  });

  it("computes final wall time for terminal status", () => {
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: t0,
          startedAt: new Date("2026-01-01T00:00:05.000Z"),
          completedAt: t1,
        },
        {
          enqueuedAt: t0,
          startedAt: null,
          completedAt: t2,
        },
      ],
      "succeeded",
    );
    expect(r).toEqual({ kind: "final", ms: 60_000 });
  });

  it("uses enqueuedAt when startedAt is null for min start", () => {
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: t0,
          startedAt: null,
          completedAt: t1,
        },
      ],
      "failed",
    );
    expect(r).toEqual({ kind: "final", ms: 10_000 });
  });

  it("returns unknown for terminal when no job completed", () => {
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: t0,
          startedAt: null,
          completedAt: null,
        },
      ],
      "failed",
    );
    expect(r).toEqual({ kind: "unknown" });
  });

  it("returns unknown for terminal when max completed is before min start", () => {
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: t0,
          startedAt: new Date("2026-01-01T00:01:00.000Z"),
          completedAt: new Date("2026-01-01T00:00:30.000Z"),
        },
      ],
      "succeeded",
    );
    expect(r).toEqual({ kind: "unknown" });
  });

  it("returns in_progress snapshot for running", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:05:00.000Z");
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: start,
          startedAt: null,
          completedAt: null,
        },
      ],
      "running",
      now,
    );
    expect(r).toEqual({ kind: "in_progress", ms: 5 * 60_000 });
  });

  it("returns in_progress snapshot for pending", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:00:30.000Z");
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: start,
          startedAt: null,
          completedAt: null,
        },
      ],
      "pending",
      now,
    );
    expect(r).toEqual({ kind: "in_progress", ms: 30_000 });
  });

  it("returns unknown for non-terminal non-running status", () => {
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: t0,
          startedAt: null,
          completedAt: null,
        },
      ],
      "unexpected",
    );
    expect(r).toEqual({ kind: "unknown" });
  });

  it("returns unknown for running when now is before min start", () => {
    const start = new Date("2026-01-01T12:00:00.000Z");
    const now = new Date("2026-01-01T00:00:00.000Z");
    const r = computePipelineWallElapsed(
      [
        {
          enqueuedAt: start,
          startedAt: null,
          completedAt: null,
        },
      ],
      "running",
      now,
    );
    expect(r).toEqual({ kind: "unknown" });
  });
});

describe("formatPipelineElapsedLabel", () => {
  it("formats unknown as em dash", () => {
    expect(formatPipelineElapsedLabel({ kind: "unknown" })).toBe("—");
  });

  it("formats final", () => {
    expect(formatPipelineElapsedLabel({ kind: "final", ms: 90_000 })).toBe(
      "1m 30s",
    );
  });

  it("formats in_progress with prefix", () => {
    expect(formatPipelineElapsedLabel({ kind: "in_progress", ms: 5000 })).toBe(
      "In progress (5s)",
    );
  });
});
