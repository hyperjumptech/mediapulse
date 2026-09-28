import { detailBlockGraphSchema } from "@hermes/domain-contract";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { stubViewportWidth } from "@/test-utils/stub-viewport-width";

import { DetailBlockGraphView } from "./detail-block-graph";
import { buildGraphModel } from "./detail-block-graph-model";
import { buildGraphScene } from "./graph/build-graph-scene";

const graphBlock = (overrides: Record<string, unknown> = {}) =>
  detailBlockGraphSchema.parse({
    type: "graph",
    label: "Knowledge graph",
    nodesField: "graph.nodes",
    edgesField: "graph.edges",
    node: {
      idField: "id",
      labelField: "label",
      groupField: "group",
      tooltipField: "tooltip",
      rankField: "rank",
    },
    edge: { sourceField: "source", targetField: "target", labelField: "label" },
    ...overrides,
  });

const sampleData = {
  integrationId: "acme",
  graph: {
    nodes: [
      { id: "s1", label: "Contract delay", group: "storyline", rank: 0 },
      {
        id: "d1",
        label: "Delay confirmed",
        group: "development",
        rank: 1,
        tooltip: "body path",
      },
    ],
    edges: [{ source: "s1", target: "d1", label: "reports" }],
  },
};

describe("DetailBlockGraphView", () => {
  beforeEach(() => {
    stubViewportWidth(1280);
  });

  it("renders the scene built from the block's data", () => {
    const block = graphBlock();
    const scene = buildGraphScene(buildGraphModel(block, sampleData));
    const { bounds } = scene;
    const { container } = render(
      <DetailBlockGraphView block={block} data={sampleData} />,
    );
    const svg = container.querySelector("svg");

    expect(
      screen.getByRole("heading", { name: "Knowledge graph" }),
    ).toBeInTheDocument();
    expect(svg?.getAttribute("role")).toBe("group");
    expect(svg?.getAttribute("viewBox")).toBe(
      `${String(bounds.minX)} ${String(bounds.minY)} ${String(bounds.width)} ${String(bounds.height)}`,
    );
    expect(container.querySelector("desc")?.textContent).toBe(
      "2 nodes and 1 connection",
    );
    for (const sceneNode of scene.nodes) {
      const mark = container.querySelector(
        `[data-graph-node-id="${sceneNode.id}"]`,
      );

      expect(mark?.getAttribute("transform")).toBe(
        `translate(${String(sceneNode.x)} ${String(sceneNode.y)})`,
      );
    }
  });

  it("labels each node with its group and connections and pins the focus node", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );
    const focusNode = screen.getByRole("button", {
      name: "Contract delay, storyline, 1 connection",
    });

    expect(
      screen.getByRole("button", {
        name: "Delay confirmed, development, 1 connection",
      }),
    ).toBeInTheDocument();
    expect(focusNode).toHaveAttribute("transform", "translate(0 0)");
    expect(focusNode).toHaveAttribute("tabindex", "0");
    expect(focusNode.querySelector("[data-graph-ring=focus]")).not.toBeNull();
    expect(container.querySelectorAll("[data-graph-ring=focus]")).toHaveLength(
      1,
    );
  });

  it("shows the tooltip and edge label once a node is selected", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );

    expect(container.textContent).not.toContain("reports");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delay confirmed, development, 1 connection",
      }),
    );
    const panel = screen.getByRole("region", {
      name: "Delay confirmed details",
    });

    expect(within(panel).getByText("body path")).toBeInTheDocument();
    expect(within(panel).getByText("development")).toBeInTheDocument();
    expect(
      container.querySelector("[data-graph-edge-label]")?.textContent,
    ).toBe("reports");
  });

  it("renders a screen-reader list describing every node and its links", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );
    const items = [...container.querySelectorAll("ul.sr-only li")].map(
      (item) => item.textContent,
    );

    expect(items).toContain(
      "Contract delay (storyline), connects to Delay confirmed",
    );
    expect(items).toContain("Delay confirmed (development)");
  });

  it("keeps node links out of the drawing and behind the Open button", () => {
    const block = graphBlock({
      node: {
        idField: "id",
        labelField: "label",
        rankField: "rank",
        linkTemplate: "/dashboard/{integrationId}/{linkResource}/{linkId}",
      },
    });
    const { container } = render(
      <DetailBlockGraphView
        block={block}
        data={{
          integrationId: "acme",
          graph: {
            nodes: [
              {
                id: "e1",
                label: "Entity one",
                rank: 0,
                linkResource: "entities",
                linkId: "entity-1",
              },
              {
                id: "s1",
                label: "Contract delay",
                rank: 1,
                linkResource: null,
                linkId: null,
              },
            ],
            edges: [],
          },
        }}
      />,
    );

    expect(container.querySelectorAll("a")).toHaveLength(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Contract delay, 0 connections" }),
    );

    expect(screen.queryByRole("link", { name: "Open" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Entity one, 0 connections" }),
    );

    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/dashboard/acme/entities/entity-1",
    );
  });

  it("renders the empty state when there are no nodes", () => {
    const block = graphBlock({ emptyState: "No developments yet." });
    const { container } = render(
      <DetailBlockGraphView block={block} data={{ graph: { nodes: [] } }} />,
    );

    expect(screen.getByText("No developments yet.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("reports the node overflow when the cap drops nodes", () => {
    const nodes = Array.from({ length: 4 }, (_unused, index) => ({
      id: `n${String(index)}`,
      label: `N${String(index)}`,
      rank: index,
    }));
    const block = graphBlock({ maxNodes: 2 });
    render(
      <DetailBlockGraphView
        block={block}
        data={{ graph: { nodes, edges: [] } }}
      />,
    );

    expect(screen.getByText(/Showing 2 of 4 nodes\./)).toBeInTheDocument();
  });

  it("renders a legend when more than one group is present", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );
    const legendItems = [
      ...container.querySelectorAll("ul:not(.sr-only) li"),
    ].map((item) => item.textContent);
    const swatches = [
      ...container.querySelectorAll("ul:not(.sr-only) li span"),
    ].map((swatch) => (swatch as HTMLElement).style.background);

    expect(legendItems).toEqual(["storyline", "development"]);
    expect(swatches).toEqual(["var(--chart-1)", "var(--chart-2)"]);
  });

  it("renders the caption template", () => {
    const block = graphBlock({
      captionTemplate: "{graph.nodes.length} nodes",
    });
    render(<DetailBlockGraphView block={block} data={sampleData} />);

    expect(screen.getByText("2 nodes")).toBeInTheDocument();
  });
});
