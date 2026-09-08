import { describe, expect, it } from "vitest";

import {
  buildPairingIndex,
  pairingKey,
  resolvePairedDependencies,
} from "./pair-wave-dependencies";

describe("pairingKey", () => {
  it("treats inputs with the same entries in a different order as one key", () => {
    const left = pairingKey({ tickerId: "t-1", limit: 10 });
    const right = pairingKey({ limit: 10, tickerId: "t-1" });

    expect(left).toBe(right);
  });

  it("separates inputs that differ in any value", () => {
    const left = pairingKey({ tickerId: "t-1" });
    const right = pairingKey({ tickerId: "t-2" });

    expect(left).not.toBe(right);
  });

  it("orders nested object keys as well as top-level ones", () => {
    const left = pairingKey({ outer: { b: 2, a: [{ y: 1, x: 0 }] } });
    const right = pairingKey({ outer: { a: [{ x: 0, y: 1 }], b: 2 } });

    expect(left).toBe(right);
  });

  it("keeps array order significant", () => {
    const left = pairingKey({ ids: ["a", "b"] });
    const right = pairingKey({ ids: ["b", "a"] });

    expect(left).not.toBe(right);
  });
});

describe("buildPairingIndex", () => {
  it("maps each distinct input to its absolute index", () => {
    const index = buildPairingIndex(
      [{ tickerId: "t-1" }, { tickerId: "t-2" }],
      5,
    );

    expect(index.get(pairingKey({ tickerId: "t-1" }))).toBe(5);
    expect(index.get(pairingKey({ tickerId: "t-2" }))).toBe(6);
  });

  it("marks a repeated input ambiguous rather than picking one", () => {
    const index = buildPairingIndex(
      [{ tickerId: "t-1" }, { tickerId: "t-1" }],
      0,
    );

    expect(index.get(pairingKey({ tickerId: "t-1" }))).toBeNull();
  });
});

describe("resolvePairedDependencies", () => {
  it("depends only on the matching upstream job", () => {
    const previousWaveIndices = [0, 1, 2];
    const index = buildPairingIndex(
      [{ tickerId: "t-1" }, { tickerId: "t-2" }, { tickerId: "t-3" }],
      0,
    );
    const resolved = resolvePairedDependencies(
      { tickerId: "t-2" },
      index,
      previousWaveIndices,
    );

    expect(resolved).toEqual([1]);
  });

  it("falls back to the whole previous wave when nothing matches", () => {
    const previousWaveIndices = [0, 1];
    const index = buildPairingIndex(
      [{ tickerId: "t-1" }, { tickerId: "t-2" }],
      0,
    );
    const resolved = resolvePairedDependencies(
      { tickerId: "t-1", newsletterId: "n-1" },
      index,
      previousWaveIndices,
    );

    expect(resolved).toEqual([0, 1]);
  });

  it("falls back to the whole previous wave when the match is ambiguous", () => {
    const previousWaveIndices = [0, 1];
    const index = buildPairingIndex(
      [{ tickerId: "t-1" }, { tickerId: "t-1" }],
      0,
    );
    const resolved = resolvePairedDependencies(
      { tickerId: "t-1" },
      index,
      previousWaveIndices,
    );

    expect(resolved).toEqual([0, 1]);
  });
});
