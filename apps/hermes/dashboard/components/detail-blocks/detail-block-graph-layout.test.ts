/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildEdgeGeometry,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  GRAPH_PADDING,
  GRAPH_RANK_GAP,
  GRAPH_SIBLING_GAP,
  placeGraphNodes,
  wrapGraphLabel,
} from "./detail-block-graph-layout";

describe("placeGraphNodes", () => {
  it("returns an empty placement for no nodes", () => {
    const placement = placeGraphNodes([], "horizontal");

    expect(placement.placed).toEqual([]);
    expect(placement.width).toBe(0);
    expect(placement.height).toBe(0);
  });

  it("advances ranks along x when horizontal", () => {
    const placement = placeGraphNodes(
      [
        { id: "a", rank: 0 },
        { id: "b", rank: 1 },
        { id: "c", rank: 2 },
      ],
      "horizontal",
    );
    const xs = placement.placed.map((node) => node.x);

    expect(xs).toEqual([
      GRAPH_PADDING,
      GRAPH_PADDING + (GRAPH_NODE_WIDTH + GRAPH_RANK_GAP),
      GRAPH_PADDING + (GRAPH_NODE_WIDTH + GRAPH_RANK_GAP) * 2,
    ]);
  });

  it("centers a short rank against the widest rank", () => {
    const placement = placeGraphNodes(
      [
        { id: "root", rank: 0 },
        { id: "first", rank: 1 },
        { id: "second", rank: 1 },
        { id: "third", rank: 1 },
      ],
      "horizontal",
    );
    const root = placement.placed.find((node) => node.id === "root");
    const second = placement.placed.find((node) => node.id === "second");

    expect(root?.y).toBe(second?.y);
  });

  it("advances ranks along y when vertical, keeping the node box unrotated", () => {
    const placement = placeGraphNodes(
      [
        { id: "a", rank: 0 },
        { id: "b", rank: 1 },
      ],
      "vertical",
    );

    expect(placement.placed.map((node) => node.y)).toEqual([
      GRAPH_PADDING,
      GRAPH_PADDING + (GRAPH_NODE_HEIGHT + GRAPH_RANK_GAP),
    ]);
    expect(placement.placed.map((node) => node.x)).toEqual([
      GRAPH_PADDING,
      GRAPH_PADDING,
    ]);
  });

  it("spreads siblings across x when vertical", () => {
    const placement = placeGraphNodes(
      [
        { id: "a", rank: 0 },
        { id: "b", rank: 1 },
        { id: "c", rank: 1 },
      ],
      "vertical",
    );
    const siblings = placement.placed.filter((node) => node.rank === 1);

    expect((siblings[1]?.x ?? 0) - (siblings[0]?.x ?? 0)).toBe(
      GRAPH_NODE_WIDTH + GRAPH_SIBLING_GAP,
    );
  });

  it("sorts ranks numerically rather than by insertion order", () => {
    const placement = placeGraphNodes(
      [
        { id: "late", rank: 10 },
        { id: "early", rank: 2 },
      ],
      "horizontal",
    );
    const early = placement.placed.find((node) => node.id === "early");
    const late = placement.placed.find((node) => node.id === "late");

    expect(early?.x).toBeLessThan(late?.x ?? 0);
  });

  it("sizes the canvas from the rank count and the widest rank", () => {
    const placement = placeGraphNodes(
      [
        { id: "a", rank: 0 },
        { id: "b", rank: 1 },
        { id: "c", rank: 1 },
      ],
      "horizontal",
    );

    expect(placement.width).toBe(
      GRAPH_PADDING * 2 + GRAPH_NODE_WIDTH * 2 + GRAPH_RANK_GAP,
    );
    expect(placement.height).toBe(
      GRAPH_PADDING * 2 + GRAPH_NODE_HEIGHT * 2 + GRAPH_SIBLING_GAP,
    );
  });
});

describe("buildEdgeGeometry", () => {
  it("anchors a horizontal edge on the facing sides of both nodes", () => {
    const geometry = buildEdgeGeometry(
      { id: "a", rank: 0, x: 0, y: 0 },
      { id: "b", rank: 1, x: 316, y: 0 },
      "horizontal",
    );

    expect(geometry.x1).toBe(GRAPH_NODE_WIDTH);
    expect(geometry.y1).toBe(GRAPH_NODE_HEIGHT / 2);
    expect(geometry.x2).toBe(316);
    expect(geometry.y2).toBe(GRAPH_NODE_HEIGHT / 2);
  });

  it("anchors a vertical edge on the bottom and top edges", () => {
    const geometry = buildEdgeGeometry(
      { id: "a", rank: 0, x: 0, y: 0 },
      { id: "b", rank: 1, x: 0, y: 140 },
      "vertical",
    );

    expect(geometry.x1).toBe(GRAPH_NODE_WIDTH / 2);
    expect(geometry.y1).toBe(GRAPH_NODE_HEIGHT);
    expect(geometry.y2).toBe(140);
  });

  it("puts the label anchor at the plain midpoint of the anchors", () => {
    const geometry = buildEdgeGeometry(
      { id: "a", rank: 0, x: 10, y: 20 },
      { id: "b", rank: 1, x: 400, y: 90 },
      "horizontal",
    );

    expect(geometry.midX).toBe((geometry.x1 + geometry.x2) / 2);
    expect(geometry.midY).toBe((geometry.y1 + geometry.y2) / 2);
  });

  it("emits a cubic bezier path starting at the source anchor", () => {
    const geometry = buildEdgeGeometry(
      { id: "a", rank: 0, x: 0, y: 0 },
      { id: "b", rank: 1, x: 316, y: 0 },
      "horizontal",
    );

    expect(geometry.path).toMatch(/^M 220 22 C /);
  });
});

describe("wrapGraphLabel", () => {
  it("returns no lines for a blank label", () => {
    expect(wrapGraphLabel("   ")).toEqual([]);
  });

  it("keeps a short label on one line", () => {
    expect(wrapGraphLabel("Contract delay")).toEqual(["Contract delay"]);
  });

  it("wraps at a word boundary", () => {
    const lines = wrapGraphLabel("alpha beta gamma delta", 12, 2);

    expect(lines[0]).toBe("alpha beta");
  });

  it("ellipsizes once the line budget is spent", () => {
    const lines = wrapGraphLabel(
      "alpha beta gamma delta epsilon zeta eta theta",
      12,
      2,
    );

    expect(lines).toHaveLength(2);
    expect(lines[1]?.endsWith("…")).toBe(true);
  });

  it("hard-slices a single word longer than the line budget", () => {
    const lines = wrapGraphLabel("supercalifragilistic", 8, 2);

    expect(lines[0]?.length).toBeLessThanOrEqual(8);
  });

  it("collapses runs of whitespace", () => {
    expect(wrapGraphLabel("alpha    beta")).toEqual(["alpha beta"]);
  });
});
