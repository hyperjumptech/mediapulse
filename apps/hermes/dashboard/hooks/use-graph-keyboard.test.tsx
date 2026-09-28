import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  GRAPH_NODE_ID_ATTRIBUTE,
  useGraphKeyboard,
  type UseGraphKeyboardOptions,
} from "./use-graph-keyboard";

type TestNode = { id: string; x: number; y: number };

const nodes: TestNode[] = [
  { id: "hub", x: 0, y: 0 },
  { id: "east", x: 100, y: 10 },
  { id: "west", x: -100, y: -10 },
  { id: "north", x: 5, y: -100 },
  { id: "south", x: -5, y: 100 },
];

type HarnessCallbacks = Pick<
  UseGraphKeyboardOptions<TestNode>,
  "onSelect" | "onClear" | "onZoomIn" | "onZoomOut" | "onFit" | "onReveal"
>;

const createCallbacks = (): HarnessCallbacks => ({
  onSelect: vi.fn(),
  onClear: vi.fn(),
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onFit: vi.fn(),
  onReveal: vi.fn(),
});

const KeyboardHarness = ({
  currentNodes,
  selectedId,
  callbacks,
}: {
  currentNodes: TestNode[];
  selectedId: string | null;
  callbacks: HarnessCallbacks;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const keyboard = useGraphKeyboard({
    nodes: currentNodes,
    initialActiveId: "hub",
    svgRef,
    selectedId,
    ...callbacks,
  });

  return (
    <div data-testid="frame" onKeyDown={keyboard.handleFrameKeyDown}>
      <svg ref={svgRef}>
        {currentNodes.map((node) => (
          <g
            key={node.id}
            {...{ [GRAPH_NODE_ID_ATTRIBUTE]: node.id }}
            role="button"
            aria-label={node.id}
            tabIndex={keyboard.activeId === node.id ? 0 : -1}
            onFocus={(event) => keyboard.handleNodeFocus(event, node.id)}
            onKeyDown={(event) => keyboard.handleNodeKeyDown(event, node.id)}
          />
        ))}
      </svg>
    </div>
  );
};

const renderKeyboard = ({
  selectedId = null,
  currentNodes = nodes,
}: { selectedId?: string | null; currentNodes?: TestNode[] } = {}) => {
  const callbacks = createCallbacks();
  const view = render(
    <KeyboardHarness
      currentNodes={currentNodes}
      selectedId={selectedId}
      callbacks={callbacks}
    />,
  );

  return { ...view, callbacks };
};

const node = (id: string) => screen.getByRole("button", { name: id });

describe("useGraphKeyboard", () => {
  it("makes only the active node tabbable, starting with the initial node", () => {
    renderKeyboard();

    expect(node("hub")).toHaveAttribute("tabindex", "0");
    expect(
      screen
        .getAllByRole("button")
        .filter((element) => element.getAttribute("tabindex") === "0"),
    ).toHaveLength(1);
  });

  it("moves focus to the nearest node in the arrow's direction", () => {
    const { callbacks } = renderKeyboard();
    act(() => node("hub").focus());

    fireEvent.keyDown(node("hub"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(node("east"));
    expect(node("east")).toHaveAttribute("tabindex", "0");
    expect(node("hub")).toHaveAttribute("tabindex", "-1");
    expect(callbacks.onReveal).toHaveBeenCalledWith(nodes[1]);

    fireEvent.keyDown(node("east"), { key: "ArrowLeft" });

    expect(document.activeElement).toBe(node("hub"));

    fireEvent.keyDown(node("hub"), { key: "ArrowUp" });

    expect(document.activeElement).toBe(node("north"));

    fireEvent.keyDown(node("north"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(node("hub"));
  });

  it("stays put when no node lies in that direction", () => {
    renderKeyboard();
    act(() => node("east").focus());

    fireEvent.keyDown(node("east"), { key: "ArrowRight" });

    expect(document.activeElement).toBe(node("east"));
  });

  it("selects the focused node with Enter or Space", () => {
    const { callbacks } = renderKeyboard();

    fireEvent.keyDown(node("west"), { key: "Enter" });
    fireEvent.keyDown(node("north"), { key: " " });

    expect(callbacks.onSelect).toHaveBeenNthCalledWith(1, "west");
    expect(callbacks.onSelect).toHaveBeenNthCalledWith(2, "north");
    expect(node("north")).toHaveAttribute("tabindex", "0");
  });

  it("zooms with plus, minus and zero", () => {
    const { callbacks } = renderKeyboard();

    fireEvent.keyDown(node("hub"), { key: "+" });
    fireEvent.keyDown(node("hub"), { key: "=" });
    fireEvent.keyDown(node("hub"), { key: "-" });
    fireEvent.keyDown(node("hub"), { key: "0" });

    expect(callbacks.onZoomIn).toHaveBeenCalledTimes(2);
    expect(callbacks.onZoomOut).toHaveBeenCalledTimes(1);
    expect(callbacks.onFit).toHaveBeenCalledTimes(1);
  });

  it("leaves browser shortcuts alone", () => {
    const { callbacks } = renderKeyboard();

    fireEvent.keyDown(node("hub"), { key: "+", ctrlKey: true });
    fireEvent.keyDown(node("hub"), { key: "0", metaKey: true });

    expect(callbacks.onZoomIn).not.toHaveBeenCalled();
    expect(callbacks.onFit).not.toHaveBeenCalled();
  });

  it("clears the selection with Escape and returns focus to that node", () => {
    const { callbacks } = renderKeyboard({ selectedId: "south" });

    fireEvent.keyDown(screen.getByTestId("frame"), { key: "Escape" });

    expect(callbacks.onClear).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(node("south"));
  });

  it("ignores Escape when nothing is selected", () => {
    const { callbacks } = renderKeyboard();

    fireEvent.keyDown(screen.getByTestId("frame"), { key: "Escape" });

    expect(callbacks.onClear).not.toHaveBeenCalled();
  });

  it("falls back to the initial node when the active node disappears", () => {
    const callbacks = createCallbacks();
    const { rerender } = render(
      <KeyboardHarness
        currentNodes={nodes}
        selectedId={null}
        callbacks={callbacks}
      />,
    );
    fireEvent.keyDown(node("hub"), { key: "Enter" });
    fireEvent.keyDown(node("east"), { key: "Enter" });

    rerender(
      <KeyboardHarness
        currentNodes={nodes.filter((candidate) => candidate.id !== "east")}
        selectedId={null}
        callbacks={callbacks}
      />,
    );

    expect(node("hub")).toHaveAttribute("tabindex", "0");
  });
});
