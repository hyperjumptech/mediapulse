/** @vitest-environment node */
import { detailBlockGraphSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import { buildGraphModel } from "./detail-block-graph-model";

const blockFor = (overrides: Record<string, unknown> = {}) =>
  detailBlockGraphSchema.parse({
    type: "graph",
    nodesField: "graph.nodes",
    edgesField: "graph.edges",
    node: { idField: "id", labelField: "label", ...(overrides.node ?? {}) },
    edge: { sourceField: "source", targetField: "target" },
    ...overrides,
    ...(overrides.node ? {} : {}),
  });

describe("buildGraphModel", () => {
  it("returns an empty model when the bound paths resolve to nothing", () => {
    const model = buildGraphModel(blockFor(), {});

    expect(model.nodes).toEqual([]);
    expect(model.edges).toEqual([]);
    expect(model.totalNodes).toBe(0);
  });

  it("drops entries with no resolvable id", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [{ id: "a", label: "A" }, { label: "no id" }, { id: "" }],
        edges: [],
      },
    });

    expect(model.nodes.map((node) => node.id)).toEqual(["a"]);
  });

  it("dedupes repeated ids keeping the first entry", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [
          { id: "a", label: "first" },
          { id: "a", label: "second" },
        ],
        edges: [],
      },
    });

    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0]?.label).toBe("first");
  });

  it("falls back to the id when the label does not resolve", () => {
    const model = buildGraphModel(blockFor(), {
      graph: { nodes: [{ id: "a" }], edges: [] },
    });

    expect(model.nodes[0]?.label).toBe("a");
  });

  it("caps nodes at maxNodes and reports the remainder", () => {
    const nodes = Array.from({ length: 5 }, (_unused, index) => ({
      id: `n${String(index)}`,
      label: `N${String(index)}`,
    }));
    const model = buildGraphModel(blockFor({ maxNodes: 3 }), {
      graph: { nodes, edges: [] },
    });

    expect(model.nodes).toHaveLength(3);
    expect(model.totalNodes).toBe(5);
    expect(model.droppedNodes).toBe(2);
  });

  it("drops edges whose endpoints were capped away", () => {
    const model = buildGraphModel(blockFor({ maxNodes: 1 }), {
      graph: {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [{ source: "a", target: "b" }],
      },
    });

    expect(model.edges).toEqual([]);
    expect(model.droppedEdges).toBe(1);
  });

  it("drops self-loops and unknown endpoints", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [
          { source: "a", target: "a" },
          { source: "a", target: "ghost" },
          { source: "a", target: "b" },
        ],
      },
    });

    expect(model.edges).toHaveLength(1);
    expect(model.droppedEdges).toBe(2);
  });

  it("dedupes identical edges", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        edges: [
          { source: "a", target: "b" },
          { source: "a", target: "b" },
        ],
      },
    });

    expect(model.edges).toHaveLength(1);
  });

  it("honors an explicit rank field", () => {
    const model = buildGraphModel(
      blockFor({
        node: { idField: "id", labelField: "label", rankField: "rank" },
      }),
      {
        graph: {
          nodes: [
            { id: "leaf", label: "Leaf", rank: 2 },
            { id: "root", label: "Root", rank: 0 },
          ],
          edges: [],
        },
      },
    );

    expect(model.nodes.map((node) => node.id)).toEqual(["root", "leaf"]);
    expect(model.nodes[1]?.rank).toBe(2);
  });

  it("derives ranks from the edge list when none are given", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        edges: [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
        ],
      },
    });
    const rankById = new Map(model.nodes.map((node) => [node.id, node.rank]));

    expect(rankById.get("a")).toBe(0);
    expect(rankById.get("b")).toBe(1);
    expect(rankById.get("c")).toBe(2);
  });

  it("takes the longest path when a node has two ancestors", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        edges: [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
          { source: "a", target: "c" },
        ],
      },
    });
    const rankById = new Map(model.nodes.map((node) => [node.id, node.rank]));

    expect(rankById.get("c")).toBe(2);
  });

  it("terminates on a cyclic edge list", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        edges: [
          { source: "a", target: "b" },
          { source: "b", target: "c" },
          { source: "c", target: "a" },
        ],
      },
    });

    expect(model.nodes).toHaveLength(3);
    for (const node of model.nodes) {
      expect(Number.isFinite(node.rank)).toBe(true);
    }
  });

  it("places an isolated node past the deepest derived rank", () => {
    const model = buildGraphModel(blockFor(), {
      graph: {
        nodes: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "lonely", label: "Lonely" },
        ],
        edges: [{ source: "a", target: "b" }],
      },
    });
    const rankById = new Map(model.nodes.map((node) => [node.id, node.rank]));

    expect(rankById.get("lonely")).toBe(0);
  });

  it("pins declared groups and rotates slots for the rest", () => {
    const model = buildGraphModel(
      blockFor({
        node: { idField: "id", labelField: "label", groupField: "group" },
        groupVariants: { storyline: "accent4" },
      }),
      {
        graph: {
          nodes: [
            { id: "a", label: "A", group: "storyline" },
            { id: "b", label: "B", group: "development" },
            { id: "c", label: "C" },
          ],
          edges: [],
        },
      },
    );
    const slotById = new Map(model.nodes.map((node) => [node.id, node.slot]));

    expect(slotById.get("a")).toBe("accent4");
    expect(slotById.get("b")).toBe("accent1");
    expect(slotById.get("c")).toBe("neutral");
    expect(model.groups).toEqual(["storyline", "development"]);
  });

  it("resolves a node link template against the entry and the response", () => {
    const model = buildGraphModel(
      blockFor({
        node: {
          idField: "id",
          labelField: "label",
          linkTemplate: "/dashboard/{integrationId}/{linkResource}/{linkId}",
        },
      }),
      {
        integrationId: "mediapulse",
        graph: {
          nodes: [
            { id: "a", label: "A", linkResource: "tickers", linkId: "t-1" },
          ],
          edges: [],
        },
      },
    );

    expect(model.nodes[0]?.href).toBe("/dashboard/mediapulse/tickers/t-1");
  });

  it("leaves a node unlinked when a template variable is null", () => {
    const model = buildGraphModel(
      blockFor({
        node: {
          idField: "id",
          labelField: "label",
          linkTemplate: "/dashboard/{integrationId}/{linkResource}/{linkId}",
        },
      }),
      {
        integrationId: "mediapulse",
        graph: {
          nodes: [{ id: "a", label: "A", linkResource: null, linkId: null }],
          edges: [],
        },
      },
    );

    expect(model.nodes[0]?.href).toBeUndefined();
  });

  it("orders siblings by the order field before input order", () => {
    const model = buildGraphModel(
      blockFor({
        node: {
          idField: "id",
          labelField: "label",
          rankField: "rank",
          orderField: "order",
        },
      }),
      {
        graph: {
          nodes: [
            { id: "second", label: "Second", rank: 1, order: 2 },
            { id: "first", label: "First", rank: 1, order: 1 },
          ],
          edges: [],
        },
      },
    );

    expect(model.nodes.map((node) => node.id)).toEqual(["first", "second"]);
  });
});
