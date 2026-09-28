import { describe, expect, it } from "vitest";

import {
  findNearestGraphNode,
  graphDirectionForKey,
  graphShortcutForKey,
} from "./graph-navigation";

const nodes = [
  { id: "origin", x: 0, y: 0 },
  { id: "near-diagonal", x: 60, y: 50 },
  { id: "far-straight", x: 120, y: 0 },
  { id: "behind", x: -40, y: 0 },
  { id: "above", x: 10, y: -90 },
];

describe("graphDirectionForKey", () => {
  it("maps the arrow keys and nothing else", () => {
    expect(graphDirectionForKey("ArrowUp")).toBe("up");
    expect(graphDirectionForKey("ArrowDown")).toBe("down");
    expect(graphDirectionForKey("ArrowLeft")).toBe("left");
    expect(graphDirectionForKey("ArrowRight")).toBe("right");
    expect(graphDirectionForKey("Enter")).toBeNull();
  });
});

describe("graphShortcutForKey", () => {
  it("maps the zoom keys and Escape", () => {
    expect(graphShortcutForKey("+")).toBe("zoom-in");
    expect(graphShortcutForKey("=")).toBe("zoom-in");
    expect(graphShortcutForKey("-")).toBe("zoom-out");
    expect(graphShortcutForKey("0")).toBe("fit");
    expect(graphShortcutForKey("Escape")).toBe("clear");
    expect(graphShortcutForKey("a")).toBeNull();
  });
});

describe("findNearestGraphNode", () => {
  it("prefers a node straight ahead over a closer one off to the side", () => {
    expect(findNearestGraphNode(nodes, "origin", "right")?.id).toBe(
      "far-straight",
    );
  });

  it("only looks in the chosen direction", () => {
    expect(findNearestGraphNode(nodes, "origin", "left")?.id).toBe("behind");
    expect(findNearestGraphNode(nodes, "origin", "up")?.id).toBe("above");
    expect(findNearestGraphNode(nodes, "origin", "down")?.id).toBe(
      "near-diagonal",
    );
  });

  it("returns null when nothing lies that way or the origin is unknown", () => {
    expect(findNearestGraphNode(nodes, "far-straight", "right")).toBeNull();
    expect(findNearestGraphNode(nodes, "missing", "right")).toBeNull();
  });
});
