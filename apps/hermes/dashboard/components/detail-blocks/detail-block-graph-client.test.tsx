import { detailBlockGraphSchema } from "@hermes/domain-contract";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DetailBlockGraphView } from "./detail-block-graph";
import { DetailBlockGraphClientView } from "./detail-block-graph-client";
import { buildGraphModel } from "./detail-block-graph-model";
import { buildGraphScene } from "./graph/build-graph-scene";

const block = detailBlockGraphSchema.parse({
  type: "graph",
  label: "Knowledge graph",
  nodesField: "graph.nodes",
  edgesField: "graph.edges",
  node: {
    idField: "id",
    labelField: "label",
    groupField: "kind",
    emphasisField: "isFocus",
    detailFields: [{ label: "Mentions", field: "mentions", format: "number" }],
  },
  edge: { sourceField: "from", targetField: "to", labelField: "relation" },
});

const data = {
  graph: {
    nodes: [
      { id: "acme", label: "Acme Holdings", kind: "Company", isFocus: true },
      { id: "freight", label: "Acme Freight", kind: "Company", mentions: 12 },
      { id: "ports", label: "Acme Ports", kind: "Company" },
      { id: "jane", label: "Jane Doe", kind: "Person" },
      { id: "harbour", label: "Harbour Authority", kind: "Regulator" },
    ],
    edges: [
      { from: "acme", to: "freight", relation: "owns" },
      { from: "acme", to: "ports", relation: "owns" },
      { from: "jane", to: "acme", relation: "leads" },
      { from: "harbour", to: "ports", relation: "licenses" },
      { from: "freight", to: "ports", relation: "supplies" },
      { from: "ports", to: "freight", relation: "supplies" },
    ],
  },
};

describe("DetailBlockGraphClientView", () => {
  it("renders the same markup as the server-built view", () => {
    const serverMarkup = renderToString(
      <DetailBlockGraphView block={block} data={data} />,
    );
    const clientMarkup = renderToString(
      <DetailBlockGraphClientView block={block} data={data} />,
    );

    expect(clientMarkup).toBe(serverMarkup);
    expect(serverMarkup).toContain('data-graph-node-id="acme"');
  });

  it("builds a scene that survives the trip from server to client", () => {
    const scene = buildGraphScene(buildGraphModel(block, data));
    const serialized = JSON.parse(JSON.stringify(scene));

    expect(serialized).toEqual(scene);
    expect(buildGraphScene(buildGraphModel(block, data))).toEqual(scene);
  });

  it("draws the graph inside a client tree", () => {
    render(<DetailBlockGraphClientView block={block} data={data} />);

    expect(
      screen.getByRole("button", {
        name: "Acme Holdings, Company, 3 connections",
      }),
    ).toHaveAttribute("tabindex", "0");
  });
});
