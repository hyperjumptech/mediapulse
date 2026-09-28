import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { stubViewportWidth } from "@/test-utils/stub-viewport-width";

import type { GraphScene, GraphSceneNode } from "./build-graph-scene";
import { GraphCanvas } from "./graph-canvas";

const sceneNode = (
  id: string,
  x: number,
  y: number,
  overrides: Partial<GraphSceneNode> = {},
): GraphSceneNode => ({
  id,
  label: id,
  details: [],
  external: false,
  emphasis: false,
  rank: 1,
  slot: "accent2",
  x,
  y,
  radius: 10,
  degree: 1,
  ...overrides,
});

const scene: GraphScene = {
  nodes: [
    sceneNode("hub", 0, 0, {
      label: "Hub company",
      group: "Company",
      rank: 0,
      degree: 3,
      slot: "accent1",
      emphasis: true,
    }),
    sceneNode("east", 100, 0, {
      label: "East subsidiary with a very long registered name",
      degree: 2,
      href: "/dashboard/entities/east",
    }),
    sceneNode("west", -100, 0, { label: "West" }),
    sceneNode("north", 0, -100, { label: "North" }),
    sceneNode("far", 200, 150, { label: "Far", rank: 2 }),
  ],
  edges: [
    {
      key: "hub->east",
      source: "hub",
      target: "east",
      label: "supplies",
      curved: false,
      bend: 0,
    },
    {
      key: "hub->west",
      source: "hub",
      target: "west",
      curved: false,
      bend: 0,
    },
    {
      key: "hub->north",
      source: "hub",
      target: "north",
      label: "owns",
      curved: true,
      bend: 0.5,
    },
    {
      key: "east->far",
      source: "east",
      target: "far",
      curved: false,
      bend: 0,
    },
  ],
  adjacency: {
    hub: ["east", "west", "north"],
    east: ["hub", "far"],
    west: ["hub"],
    north: ["hub"],
    far: ["east"],
  },
  bounds: { minX: -200, minY: -150, width: 500, height: 400 },
  focusId: "hub",
};

const renderCanvas = () =>
  render(<GraphCanvas scene={scene} title="Knowledge graph" maxHeight={480} />);

const node = (name: string | RegExp) => screen.getByRole("button", { name });

const hub = () => node("Hub company, Company, 3 connections");
const east = () => node(/^East subsidiary/);

const svgOf = (container: HTMLElement) => {
  const svg = container.querySelector("svg");
  if (!svg) {
    throw new Error("graph svg missing");
  }

  return svg;
};

const viewportTransform = (container: HTMLElement) =>
  container.querySelector("svg > g")?.getAttribute("transform");

const edgeLabels = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-graph-edge-label]")].map(
    (label) => label.textContent,
  );

const nodeLabels = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-graph-node-id] text")].map(
    (label) => label.textContent,
  );

describe("GraphCanvas", () => {
  beforeEach(() => {
    stubViewportWidth(1280);
  });

  it("fits the whole scene into a frame capped by the block's height", () => {
    const { container } = renderCanvas();
    const svg = svgOf(container);
    const frame = container.querySelector("[data-slot=graph-frame]");

    expect(svg.getAttribute("viewBox")).toBe("-200 -150 500 400");
    expect(svg.getAttribute("role")).toBe("group");
    expect(frame).toHaveStyle({ "--graph-height": "480px" });
    expect(frame?.className).toContain("h-[min(var(--graph-height),70vh)]");
    expect(frame?.className).toContain("rounded-lg");
    expect(viewportTransform(container)).toBeNull();
  });

  it("names the graph and every node for assistive tech", () => {
    const { container } = renderCanvas();
    const svg = svgOf(container);
    const titleId = svg.getAttribute("aria-labelledby") ?? "";
    const descriptionId = svg.getAttribute("aria-describedby") ?? "";

    expect(container.querySelector(`[id="${titleId}"]`)?.textContent).toBe(
      "Knowledge graph",
    );
    expect(
      container.querySelector(`[id="${descriptionId}"]`)?.textContent,
    ).toBe("5 nodes and 4 connections");
    expect(hub()).toBeInTheDocument();
    expect(node("West, 1 connection")).toBeInTheDocument();
  });

  it("truncates node labels and keeps the full label in the title", () => {
    const { container } = renderCanvas();

    expect(nodeLabels(container)).toContain("East subsidiary with a…");
    expect(east().querySelector("title")?.textContent).toBe(
      "East subsidiary with a very long registered name",
    );
  });

  it("gives only the focus node the heavier ring", () => {
    const { container } = renderCanvas();
    const focusRings = container.querySelectorAll("[data-graph-ring=focus]");

    expect(focusRings).toHaveLength(1);
    expect(hub().contains(focusRings[0] ?? null)).toBe(true);
  });

  it("draws every edge with an arrowhead and bends curved edges", () => {
    const { container } = renderCanvas();
    const edges = [...container.querySelectorAll("[data-graph-edge]")];
    const curved = container.querySelector("[data-graph-edge='hub->north']");

    expect(edges).toHaveLength(4);
    for (const edge of edges) {
      expect(edge.getAttribute("marker-mid")).toMatch(
        /^url\(#graph-.+-arrow\)$/,
      );
    }
    expect(container.querySelectorAll("marker")).toHaveLength(2);
    expect(curved?.getAttribute("d")).toContain("Q");
  });

  it("keeps edge labels hidden until a node is selected", () => {
    const { container } = renderCanvas();

    expect(edgeLabels(container)).toEqual([]);

    fireEvent.click(hub());

    expect(edgeLabels(container)).toEqual(["supplies", "owns"]);

    fireEvent.click(node("Far, 1 connection"));

    expect(edgeLabels(container)).toEqual([]);
  });

  it("selects a node on click and dims everything outside its neighbourhood", () => {
    const { container } = renderCanvas();

    fireEvent.click(east());

    expect(east()).toHaveAttribute("aria-current", "true");
    expect(east()).toHaveStyle({ opacity: "1" });
    expect(hub()).toHaveStyle({ opacity: "1" });
    expect(node("Far, 1 connection")).toHaveStyle({ opacity: "1" });
    expect(node("West, 1 connection")).toHaveStyle({ opacity: "0.2" });
    expect(node("North, 1 connection")).toHaveStyle({ opacity: "0.2" });
    expect(
      container.querySelector("[data-graph-edge='hub->east']"),
    ).toHaveAttribute("data-emphasis", "highlighted");
    expect(
      container.querySelector("[data-graph-edge='east->far']"),
    ).toHaveAttribute("data-emphasis", "highlighted");
    expect(
      container.querySelector("[data-graph-edge='hub->west']"),
    ).toHaveAttribute("data-emphasis", "dimmed");
  });

  it("never navigates from a node and offers the Open link in the details panel", () => {
    const { container } = renderCanvas();

    expect(svgOf(container).querySelector("a")).toBeNull();

    fireEvent.click(east());
    const panel = screen.getByRole("region", { name: /details$/ });

    expect(within(panel).getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "/dashboard/entities/east",
    );
    expect(within(panel).getByText("Connections (2)")).toBeInTheDocument();
  });

  it("selects a neighbour from the details panel", () => {
    renderCanvas();
    fireEvent.click(east());
    const panel = screen.getByRole("region", { name: /details$/ });

    fireEvent.click(within(panel).getByRole("button", { name: "Hub company" }));

    expect(hub()).toHaveAttribute("aria-current", "true");
    expect(document.activeElement).toBe(hub());
    expect(
      screen.getByRole("region", { name: "Hub company details" }),
    ).toBeInTheDocument();
  });

  it("clears the selection with Escape", () => {
    renderCanvas();
    fireEvent.click(east());

    fireEvent.keyDown(east(), { key: "Escape" });

    expect(east()).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("region", { name: /details$/ })).toBeNull();
    expect(node("West, 1 connection")).toHaveStyle({ opacity: "1" });
  });

  it("clears the selection when the background is clicked", () => {
    const { container } = renderCanvas();
    fireEvent.click(east());

    fireEvent.click(svgOf(container));

    expect(east()).not.toHaveAttribute("aria-current");
  });

  it("moves a single tab stop between nodes with the arrow keys", () => {
    renderCanvas();

    expect(hub()).toHaveAttribute("tabindex", "0");
    expect(east()).toHaveAttribute("tabindex", "-1");

    act(() => hub().focus());
    fireEvent.keyDown(hub(), { key: "ArrowRight" });

    expect(document.activeElement).toBe(east());
    expect(east()).toHaveAttribute("tabindex", "0");
    expect(hub()).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(east(), { key: "Enter" });

    expect(east()).toHaveAttribute("aria-current", "true");
  });

  it("zooms from the corner buttons and the keyboard", () => {
    const { container } = renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(viewportTransform(container)).toContain("scale(1.25)");

    fireEvent.keyDown(hub(), { key: "0" });

    expect(viewportTransform(container)).toBe("translate(0,0) scale(1)");

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.keyDown(hub(), { key: "-" });

    expect(viewportTransform(container)).toMatch(/scale\(0\.64\d*\)/);

    fireEvent.click(screen.getByRole("button", { name: "Fit graph" }));

    expect(viewportTransform(container)).toBe("translate(0,0) scale(1)");
  });

  it("shows every edge label from 1.2x", () => {
    const { container } = renderCanvas();

    fireEvent.keyDown(hub(), { key: "+" });

    expect(edgeLabels(container)).toEqual(["supplies", "owns"]);
  });

  it("hides labels away from the selection and the focus node below 0.7x", () => {
    const { container } = renderCanvas();

    fireEvent.keyDown(hub(), { key: "-" });
    fireEvent.keyDown(hub(), { key: "-" });

    expect(nodeLabels(container)).toEqual(["Hub company"]);

    fireEvent.click(node("Far, 1 connection"));

    expect(nodeLabels(container)).toEqual([
      "Hub company",
      "East subsidiary with a…",
      "Far",
    ]);
  });

  it("hints once that a plain scroll does not zoom", () => {
    const { container } = renderCanvas();

    fireEvent.wheel(svgOf(container), { deltaY: 120 });

    expect(screen.getByRole("status")).toHaveTextContent("Hold Ctrl/⌘ to zoom");
    expect(viewportTransform(container)).toBeNull();
  });
});
