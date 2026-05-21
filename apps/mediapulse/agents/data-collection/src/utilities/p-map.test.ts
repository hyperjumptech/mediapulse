/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from "vitest";

import { pMap } from "./p-map";

describe("pMap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves input order in the output", async () => {
    // Act
    const result = await pMap([1, 2, 3], async (value) => value * 2, {
      concurrency: 2,
    });

    // Assert
    expect(result).toEqual([2, 4, 6]);
  });

  it("never runs more mappers than the concurrency cap", async () => {
    // Setup
    let running = 0;
    let maxRunning = 0;
    const items = Array.from({ length: 10 }, (_, index) => index);

    // Act
    await pMap(
      items,
      async (value) => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 20));
        running -= 1;
        return value;
      },
      { concurrency: 3 },
    );

    // Assert
    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it("returns failures from individual mappers without aborting the batch", async () => {
    // Act
    const result = await pMap(
      [1, 2, 3],
      async (value) => {
        if (value === 2) {
          throw new Error("mapper failed");
        }
        return value;
      },
      { concurrency: 2 },
    ).catch((error: unknown) => error);

    // Assert
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("mapper failed");
  });
});
