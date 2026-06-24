/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  AllProvidersFailed,
  dispatch,
  RoundRobinCursor,
  type DispatchProvider,
} from "./provider-dispatch";

const makeProvider = (
  name: string,
  run: () => Promise<string[]>,
): DispatchProvider<string[]> => ({ name, run });

const nonEmpty = (result: string[]): boolean => result.length > 0;

describe("RoundRobinCursor", () => {
  it("advances per call within a capability", () => {
    const cursor = new RoundRobinCursor();

    expect(cursor.next("search")).toBe(0);
    expect(cursor.next("search")).toBe(1);
    expect(cursor.next("search")).toBe(2);
  });

  it("tracks capabilities independently", () => {
    const cursor = new RoundRobinCursor();
    cursor.next("search");

    expect(cursor.next("fetch")).toBe(0);
    expect(cursor.next("search")).toBe(1);
  });
});

describe("dispatch", () => {
  it("rotates the starting provider per call", async () => {
    const cursor = new RoundRobinCursor();
    const calls: string[] = [];
    const providers = ["a", "b", "c"].map((name) =>
      makeProvider(name, async () => {
        calls.push(name);
        return [name];
      }),
    );

    const first = await dispatch("search", providers, nonEmpty, cursor);
    const second = await dispatch("search", providers, nonEmpty, cursor);

    expect(first).toEqual(["a"]);
    expect(second).toEqual(["b"]);
  });

  it("falls back to the next provider on error", async () => {
    const cursor = new RoundRobinCursor();
    const providers = [
      makeProvider("a", async () => {
        throw new Error("boom");
      }),
      makeProvider("b", async () => ["b"]),
    ];

    const result = await dispatch("search", providers, nonEmpty, cursor);

    expect(result).toEqual(["b"]);
  });

  it("returns the last result when none is accepted", async () => {
    const cursor = new RoundRobinCursor();
    const providers = [
      makeProvider("a", async () => []),
      makeProvider("b", async () => []),
    ];

    const result = await dispatch("search", providers, nonEmpty, cursor);

    expect(result).toEqual([]);
  });

  it("throws AllProvidersFailed when every provider throws", async () => {
    const cursor = new RoundRobinCursor();
    const providers = [
      makeProvider("a", async () => {
        throw new Error("a failed");
      }),
      makeProvider("b", async () => {
        throw new Error("b failed");
      }),
    ];

    await expect(
      dispatch("search", providers, nonEmpty, cursor),
    ).rejects.toBeInstanceOf(AllProvidersFailed);

    try {
      await dispatch("fetch", providers, nonEmpty, cursor);
    } catch (error) {
      const failed = error as AllProvidersFailed;

      expect(failed.capability).toBe("fetch");
      expect(failed.errors.map((entry) => entry.provider)).toEqual(["a", "b"]);
    }
  });

  it("throws AllProvidersFailed for an empty pool", async () => {
    const cursor = new RoundRobinCursor();

    await expect(
      dispatch("search", [], nonEmpty, cursor),
    ).rejects.toBeInstanceOf(AllProvidersFailed);
  });
});
