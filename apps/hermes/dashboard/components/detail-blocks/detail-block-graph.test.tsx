/** @vitest-environment jsdom */
import { detailBlockGraphSchema } from "@hermes/domain-contract";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockGraphView } from "./detail-block-graph";

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
  integrationId: "mediapulse",
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
  it("renders an accessible svg labelled by its title and description", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("role")).toBe("img");
    expect(container.querySelector("desc")?.textContent).toBe(
      "2 nodes and 1 connection",
    );
    const labelledBy = svg?.getAttribute("aria-labelledby")?.split(" ") ?? [];
    expect(labelledBy).toHaveLength(2);
    for (const id of labelledBy) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("renders one node title carrying the label and tooltip", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );
    const titles = [...container.querySelectorAll("title")].map(
      (node) => node.textContent,
    );

    expect(titles).toContain("Delay confirmed — body path");
    expect(titles).toContain("Contract delay");
  });

  it("renders the edge label", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );

    expect(container.textContent).toContain("reports");
  });

  it("renders a screen-reader list describing every node and its links", () => {
    const { container } = render(
      <DetailBlockGraphView block={graphBlock()} data={sampleData} />,
    );
    const items = [...container.querySelectorAll("ul.sr-only li")].map(
      (node) => node.textContent,
    );

    expect(items).toContain(
      "Contract delay (storyline), connects to Delay confirmed",
    );
    expect(items).toContain("Delay confirmed (development)");
  });

  it("links only the nodes whose link template resolves", () => {
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
          integrationId: "mediapulse",
          graph: {
            nodes: [
              {
                id: "t1",
                label: "FORE",
                rank: 0,
                linkResource: "tickers",
                linkId: "ticker-1",
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
    const anchors = [...container.querySelectorAll("a")];

    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.getAttribute("href")).toBe(
      "/dashboard/mediapulse/tickers/ticker-1",
    );
  });

  it("renders the empty state when there are no nodes", () => {
    const block = graphBlock({ emptyState: "No developments yet." });
    render(
      <DetailBlockGraphView block={block} data={{ graph: { nodes: [] } }} />,
    );

    expect(screen.getByText("No developments yet.")).toBeInTheDocument();
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
    ].map((node) => node.textContent);

    expect(legendItems).toEqual(["storyline", "development"]);
  });

  it("renders the caption template", () => {
    const block = graphBlock({
      captionTemplate: "{graph.nodes.length} nodes",
    });
    render(<DetailBlockGraphView block={block} data={sampleData} />);

    expect(screen.getByText("2 nodes")).toBeInTheDocument();
  });
});
