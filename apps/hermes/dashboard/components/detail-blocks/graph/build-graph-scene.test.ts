import { describe, expect, it } from "vitest";

import { detailBlockSchema } from "@hermes/domain-contract";

import {
  buildGraphModel,
  type GraphModel,
  type GraphModelNode,
} from "../detail-block-graph-model";

import { buildGraphScene, createSeededRandom } from "./build-graph-scene";

const node = (
  id: string,
  rank: number,
  overrides: Partial<GraphModelNode> = {},
): GraphModelNode => ({
  id,
  label: id,
  details: [],
  external: false,
  emphasis: false,
  rank,
  slot: "neutral",
  ...overrides,
});

const model: GraphModel = {
  nodes: [
    node("issuer", 0, { emphasis: true }),
    node("entity-a", 1),
    node("entity-b", 1),
    node("article-1", 2),
    node("article-2", 2),
  ],
  edges: [
    { key: "e1", source: "issuer", target: "entity-a" },
    { key: "e2", source: "issuer", target: "entity-b" },
    { key: "e3", source: "entity-a", target: "entity-b", label: "owns" },
    { key: "e4", source: "entity-a", target: "article-1" },
    { key: "e5", source: "entity-b", target: "article-2" },
    { key: "e6", source: "article-2", target: "entity-b" },
  ],
  groups: [],
  totalNodes: 5,
  droppedNodes: 0,
  droppedEdges: 0,
};

describe("buildGraphScene", () => {
  it("draws the same picture every time for the same graph", () => {
    const first = buildGraphScene(model);
    const second = buildGraphScene(structuredClone(model));

    expect(second).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
  });

  it("pins the focus node at the centre and spreads the rest around it", () => {
    const scene = buildGraphScene(model);
    const byId = new Map(
      scene.nodes.map((sceneNode) => [sceneNode.id, sceneNode]),
    );

    expect(scene.focusId).toBe("issuer");
    expect(byId.get("issuer")).toMatchObject({ x: 0, y: 0 });
    const others = scene.nodes.filter((sceneNode) => sceneNode.id !== "issuer");
    const quadrants = new Set(
      others.map(
        (sceneNode) => `${Math.sign(sceneNode.x)}:${Math.sign(sceneNode.y)}`,
      ),
    );

    expect(quadrants.size).toBeGreaterThan(1);
    for (const sceneNode of others) {
      expect(Math.hypot(sceneNode.x, sceneNode.y)).toBeGreaterThan(40);
    }
  });

  it("keeps nodes from overlapping", () => {
    const scene = buildGraphScene(model);

    for (const [index, left] of scene.nodes.entries()) {
      for (const right of scene.nodes.slice(index + 1)) {
        const distance = Math.hypot(left.x - right.x, left.y - right.y);

        expect(distance).toBeGreaterThan(left.radius + right.radius);
      }
    }
  });

  it("lists each node's neighbours in both directions", () => {
    const scene = buildGraphScene(model);

    expect(scene.adjacency.issuer).toEqual(["entity-a", "entity-b"]);
    expect(scene.adjacency["entity-b"]).toEqual(
      expect.arrayContaining(["issuer", "entity-a", "article-2"]),
    );
    expect(scene.adjacency["entity-b"]).toHaveLength(3);
  });

  it("curves edges within a ring and edges that go both ways", () => {
    const curved = Object.fromEntries(
      buildGraphScene(model).edges.map((edge) => [edge.key, edge.curved]),
    );

    expect(curved).toEqual({
      e1: false,
      e2: false,
      e3: true,
      e4: false,
      e5: true,
      e6: true,
    });
  });

  it("bends parallel and reciprocal edges apart so they never draw on top of each other", () => {
    const parallel: GraphModel = {
      ...model,
      edges: [
        { key: "p1", source: "entity-a", target: "article-1", label: "owns" },
        {
          key: "p2",
          source: "entity-a",
          target: "article-1",
          label: "operates",
        },
        { key: "p3", source: "article-1", target: "entity-a", label: "names" },
      ],
    };
    const edges = buildGraphScene(parallel).edges;
    const canonicalOffsets = edges.map((edge) =>
      edge.source < edge.target ? edge.bend : -edge.bend,
    );

    expect(new Set(canonicalOffsets).size).toBe(3);
    expect(edges.filter((edge) => edge.curved)).toHaveLength(2);
  });

  it("draws a single edge between different rings straight", () => {
    const edge = buildGraphScene(model).edges.find(
      (sceneEdge) => sceneEdge.key === "e4",
    );

    expect(edge).toMatchObject({ curved: false, bend: 0 });
  });

  it("frames every node and its label inside the bounds", () => {
    const { nodes, bounds } = buildGraphScene(model);

    for (const sceneNode of nodes) {
      expect(sceneNode.x).toBeGreaterThan(bounds.minX);
      expect(sceneNode.x).toBeLessThan(bounds.minX + bounds.width);
      expect(sceneNode.y).toBeGreaterThan(bounds.minY);
      expect(sceneNode.y).toBeLessThan(bounds.minY + bounds.height);
    }
  });

  it("returns an empty frame for an empty graph", () => {
    const scene = buildGraphScene({ ...model, nodes: [], edges: [] });

    expect(scene.nodes).toEqual([]);
    expect(scene.focusId).toBeNull();
    expect(scene.bounds.width).toBeGreaterThan(0);
  });
});

describe("createSeededRandom", () => {
  it("repeats the same sequence for the same seed", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    const values = [first(), first(), first()];

    expect([second(), second(), second()]).toEqual(values);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("buildGraphScene with derived ranks", () => {
  it("stays compact when entities point at each other both ways", () => {
    const block = detailBlockSchema.parse({
      type: "graph",
      nodesField: "graph.nodes",
      edgesField: "graph.edges",
      node: { idField: "id", labelField: "label" },
      edge: { sourceField: "source", targetField: "target" },
    });
    if (block.type !== "graph") throw new Error("expected graph");
    const entityIds = Array.from({ length: 28 }, (_, index) => `e${index}`);
    const graph = {
      nodes: [
        { id: "root", label: "Root" },
        ...entityIds.map((id) => ({ id, label: id })),
      ],
      edges: [
        ...entityIds.map((id) => ({ source: "root", target: id })),
        { source: "e0", target: "e1" },
        { source: "e1", target: "e0" },
        { source: "e2", target: "e3" },
        { source: "e3", target: "e2" },
      ],
    };

    const scene = buildGraphScene(buildGraphModel(block, { graph }));

    expect(Math.max(...scene.nodes.map((sceneNode) => sceneNode.rank))).toBe(1);
    expect(scene.bounds.width).toBeLessThan(1200);
    expect(scene.bounds.height).toBeLessThan(1200);
  });
});
