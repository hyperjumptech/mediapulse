import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubViewportWidth } from "@/test-utils/stub-viewport-width";

import type { GraphSceneNode } from "./build-graph-scene";
import { GraphNodeDetails } from "./graph-node-details";

const sceneNode = (
  id: string,
  overrides: Partial<GraphSceneNode> = {},
): GraphSceneNode => ({
  id,
  label: id,
  details: [],
  external: false,
  emphasis: false,
  rank: 0,
  slot: "accent1",
  x: 0,
  y: 0,
  radius: 10,
  degree: 0,
  ...overrides,
});

const selectedNode = sceneNode("acme", {
  label: "Acme Holdings",
  group: "Company",
  tooltip: "Parent of the operating subsidiaries.",
  degree: 2,
  details: [
    { label: "Mentions", value: "1234567", format: "number" },
    { label: "Website", value: "https://acme.example/about", format: "url" },
    { label: "Unsafe", value: "javascript:alert(1)", format: "url" },
    { label: "First seen", value: "2026-09-01T08:30:00Z", format: "date-time" },
    { label: "Sector", value: "Logistics", format: "text" },
  ],
});

const connections = [
  sceneNode("sub-a", { label: "Acme Freight" }),
  sceneNode("sub-b", { label: "Acme Ports", slot: "accent2" }),
];

const renderDetails = (
  node: GraphSceneNode = selectedNode,
  handlers = { onSelectNode: vi.fn(), onClose: vi.fn() },
) => {
  const view = render(
    <GraphNodeDetails
      node={node}
      connections={connections}
      onSelectNode={handlers.onSelectNode}
      onClose={handlers.onClose}
    />,
  );

  return { ...view, handlers };
};

describe("GraphNodeDetails on desktop", () => {
  beforeEach(() => {
    stubViewportWidth(1280);
  });

  it("shows the label, group badge and tooltip in a card without opening a sheet", () => {
    renderDetails();
    const panel = screen.getByRole("region", { name: "Acme Holdings details" });

    expect(
      within(panel).getByRole("heading", { name: "Acme Holdings" }),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Company")).toHaveAttribute(
      "data-slot",
      "badge",
    );
    expect(
      within(panel).getByText("Parent of the operating subsidiaries."),
    ).toBeInTheDocument();
    expect(panel.className).toContain("w-72");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists the facts with en-US numbers, safe links and local dates", () => {
    renderDetails();
    const facts = screen.getByRole("region", { name: "Acme Holdings details" });
    const website = within(facts).getByRole("link", {
      name: "https://acme.example/about",
    });

    expect(within(facts).getByText("1,234,567")).toBeInTheDocument();
    expect(website).toHaveAttribute("href", "https://acme.example/about");
    expect(website).toHaveAttribute("target", "_blank");
    expect(website).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      within(facts).queryByRole("link", { name: "javascript:alert(1)" }),
    ).not.toBeInTheDocument();
    expect(within(facts).getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(
      facts.querySelector("time[datetime='2026-09-01T08:30:00.000Z']"),
    ).not.toBeNull();
    expect(within(facts).getByText("Logistics")).toBeInTheDocument();
  });

  it("lists the connections as buttons that select that node", () => {
    const { handlers } = renderDetails();
    const panel = screen.getByRole("region", { name: "Acme Holdings details" });

    expect(within(panel).getByText("Connections (2)")).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole("button", { name: "Acme Ports" }));

    expect(handlers.onSelectNode).toHaveBeenCalledWith("sub-b");
  });

  it("offers an Open link only when the node has one", () => {
    const { rerender, handlers } = renderDetails();

    expect(
      screen.queryByRole("link", { name: /Open/ }),
    ).not.toBeInTheDocument();

    rerender(
      <GraphNodeDetails
        node={{ ...selectedNode, href: "/dashboard/entities/acme" }}
        connections={connections}
        onSelectNode={handlers.onSelectNode}
        onClose={handlers.onClose}
      />,
    );
    const internalLink = screen.getByRole("link", { name: "Open" });

    expect(internalLink).toHaveAttribute("href", "/dashboard/entities/acme");
    expect(internalLink).not.toHaveAttribute("target");
  });

  it("opens an external link in a new tab", () => {
    renderDetails({
      ...selectedNode,
      href: "https://acme.example",
      external: true,
    });
    const externalLink = screen.getByRole("link", {
      name: "Open (opens in a new tab)",
    });

    expect(externalLink).toHaveAttribute("href", "https://acme.example");
    expect(externalLink).toHaveAttribute("target", "_blank");
    expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("closes from the card's close button", () => {
    const { handlers } = renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Close details" }));

    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it("shows no connection buttons for an isolated node", () => {
    render(
      <GraphNodeDetails
        node={sceneNode("alone")}
        connections={[]}
        onSelectNode={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Connections (0)")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("GraphNodeDetails on a phone", () => {
  beforeEach(() => {
    stubViewportWidth(375);
  });

  it("opens a bottom sheet titled with the node label", async () => {
    renderDetails();
    const sheet = await screen.findByRole("dialog");

    expect(
      within(sheet).getByRole("heading", { name: "Acme Holdings" }),
    ).toBeInTheDocument();
    expect(sheet.className).toContain("bottom-0");
    expect(within(sheet).getByText("Connections (2)")).toBeInTheDocument();
  });

  it("clears the selection when the sheet is dismissed", async () => {
    const { handlers } = renderDetails();
    const sheet = await screen.findByRole("dialog");

    fireEvent.keyDown(sheet, { key: "Escape" });

    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });
});
