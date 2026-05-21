import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runExtractionsInParallel } from "./parallel-extraction.js";

const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("runExtractionsInParallel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("respects concurrency and records peak in-flight", async () => {
    // Setup
    const items = Array.from({ length: 10 }, (_, index) => index);
    let inFlight = 0;
    let peakInFlight = 0;

    // Act
    const startedAt = Date.now();
    const { results, stats } = await runExtractionsInParallel(
      items,
      async () => {
        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await sleepMs(100);
        inFlight -= 1;
        return "ok";
      },
      { concurrency: 3 },
    );
    const elapsedMs = Date.now() - startedAt;

    // Assert
    expect(results).toHaveLength(10);
    expect(results.every((result) => result.ok && result.value === "ok")).toBe(
      true,
    );
    expect(stats.peakInFlight).toBe(3);
    expect(peakInFlight).toBe(3);
    expect(stats.extractionSkippedDueToDeadline).toBe(0);
    expect(elapsedMs).toBeGreaterThanOrEqual(300);
    expect(elapsedMs).toBeLessThan(700);
  });

  it("skips undispatched items after deadline without cancelling in-flight work", async () => {
    // Setup
    const items = Array.from({ length: 10 }, (_, index) => index);
    const onDeadlineSkip = vi.fn();
    const startedIndices: number[] = [];
    const completedIndices: number[] = [];

    // Act
    const { results, stats } = await runExtractionsInParallel(
      items,
      async (item) => {
        startedIndices.push(item);
        await sleepMs(100);
        completedIndices.push(item);
        return item;
      },
      {
        concurrency: 1,
        deadlineAtMs: Date.now() + 200,
        onDeadlineSkip: (item) => {
          onDeadlineSkip(item);
        },
      },
    );

    // Assert
    expect(results).toHaveLength(2);
    expect(results.map((result) => (result.ok ? result.value : null))).toEqual([
      0, 1,
    ]);
    expect(onDeadlineSkip).toHaveBeenCalledTimes(8);
    expect(stats.extractionSkippedDueToDeadline).toBe(8);
    expect(stats.deadlineFiredAtMs).toEqual(expect.any(Number));
    expect(startedIndices).toEqual([0, 1]);
    expect(completedIndices).toEqual([0, 1]);
  });

  it("isolates worker errors without aborting remaining items", async () => {
    // Setup
    const items = ["a", "b", "c"];

    // Act
    const { results } = await runExtractionsInParallel(
      items,
      async (item) => {
        if (item === "b") {
          throw new Error("boom");
        }
        return item.toUpperCase();
      },
      { concurrency: 2 },
    );

    // Assert
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ ok: true, index: 0, value: "A" });
    expect(results[1]).toEqual({
      ok: false,
      index: 1,
      error: expect.objectContaining({ message: "boom" }),
    });
    expect(results[2]).toEqual({ ok: true, index: 2, value: "C" });
  });

  it("returns results sorted by original batch index", async () => {
    // Setup
    const items = [1, 2, 3, 4, 5];

    // Act
    const { results } = await runExtractionsInParallel(
      items,
      async (item) => {
        await sleepMs((5 - item) * 10);
        return item * 10;
      },
      { concurrency: 5 },
    );

    // Assert
    expect(results.map((result) => (result.ok ? result.index : -1))).toEqual([
      0, 1, 2, 3, 4,
    ]);
    expect(results.map((result) => (result.ok ? result.value : null))).toEqual([
      10, 20, 30, 40, 50,
    ]);
  });
});
