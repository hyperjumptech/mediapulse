import { describe, expect, it } from "vitest";

import { buildGraphEdgeGeometry } from "./graph-edge-geometry";

describe("buildGraphEdgeGeometry", () => {
  it("draws a straight line through its midpoint when the bend is zero", () => {
    const geometry = buildGraphEdgeGeometry(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      0,
    );

    expect(geometry).toEqual({
      path: "M 0 0 L 50 0 L 100 0",
      midX: 50,
      midY: 0,
      labelAngle: 0,
    });
  });

  it("bends toward the perpendicular rotated +90 degrees from source to target", () => {
    const geometry = buildGraphEdgeGeometry(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      0.5,
    );

    expect(geometry.path).toBe("M 0 0 Q 25 10 50 10 Q 75 10 100 0");
    expect(geometry.midX).toBe(50);
    expect(geometry.midY).toBe(10);
  });

  it("places the midpoint at t = 0.5 on the quadratic curve", () => {
    const source = { x: 10, y: 20 };
    const target = { x: 70, y: -60 };
    const bend = -1;
    const distance = Math.hypot(target.x - source.x, target.y - source.y);
    const controlX =
      (source.x + target.x) / 2 +
      (-(target.y - source.y) / distance) * bend * distance * 0.4;
    const controlY =
      (source.y + target.y) / 2 +
      ((target.x - source.x) / distance) * bend * distance * 0.4;
    const expectedX = 0.25 * source.x + 0.5 * controlX + 0.25 * target.x;
    const expectedY = 0.25 * source.y + 0.5 * controlY + 0.25 * target.y;

    const geometry = buildGraphEdgeGeometry(source, target, bend);

    expect(geometry.midX).toBeCloseTo(expectedX, 1);
    expect(geometry.midY).toBeCloseTo(expectedY, 1);
  });

  it("separates reciprocal edges whose bends mirror each other", () => {
    const forward = buildGraphEdgeGeometry(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      0.5,
    );
    const backward = buildGraphEdgeGeometry(
      { x: 100, y: 0 },
      { x: 0, y: 0 },
      0.5,
    );

    expect(forward.midY).toBe(10);
    expect(backward.midY).toBe(-10);
  });

  it("keeps edge labels upright whichever way the edge points", () => {
    const leftward = buildGraphEdgeGeometry(
      { x: 100, y: 0 },
      { x: 0, y: 0 },
      0,
    );
    const downward = buildGraphEdgeGeometry({ x: 0, y: 0 }, { x: 0, y: 80 }, 0);

    expect(leftward.labelAngle).toBe(0);
    expect(downward.labelAngle).toBe(90);
  });

  it("does not produce NaN for two nodes on the same spot", () => {
    const geometry = buildGraphEdgeGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }, 1);

    expect(geometry.path).not.toContain("NaN");
    expect(geometry.midX).toBe(5);
    expect(geometry.labelAngle).toBe(0);
  });
});
