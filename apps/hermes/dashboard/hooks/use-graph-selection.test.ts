import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useGraphSelection } from "./use-graph-selection";

const adjacency: Record<string, string[]> = {
  hub: ["east", "west"],
  east: ["hub", "far"],
  west: ["hub"],
  far: ["east"],
};

describe("useGraphSelection", () => {
  it("starts with nothing selected and nothing dimmed", () => {
    const { result } = renderHook(() => useGraphSelection(adjacency));

    expect(result.current.selectedId).toBeNull();
    expect(result.current.nodeEmphasis("hub")).toBe("normal");
    expect(result.current.edgeEmphasis({ source: "hub", target: "east" })).toBe(
      "normal",
    );
  });

  it("keeps the selected node and its neighbours bright and dims the rest", () => {
    const { result } = renderHook(() => useGraphSelection(adjacency));

    act(() => result.current.select("east"));

    expect(result.current.selectedId).toBe("east");
    expect([...result.current.neighbourIds]).toEqual(["hub", "far"]);
    expect(result.current.nodeEmphasis("east")).toBe("selected");
    expect(result.current.nodeEmphasis("hub")).toBe("neighbour");
    expect(result.current.nodeEmphasis("far")).toBe("neighbour");
    expect(result.current.nodeEmphasis("west")).toBe("dimmed");
  });

  it("highlights only the edges that touch the selected node", () => {
    const { result } = renderHook(() => useGraphSelection(adjacency));

    act(() => result.current.select("east"));

    expect(result.current.edgeEmphasis({ source: "hub", target: "east" })).toBe(
      "highlighted",
    );
    expect(result.current.edgeEmphasis({ source: "east", target: "far" })).toBe(
      "highlighted",
    );
    expect(result.current.edgeEmphasis({ source: "hub", target: "west" })).toBe(
      "dimmed",
    );
  });

  it("clears the selection", () => {
    const { result } = renderHook(() => useGraphSelection(adjacency));

    act(() => result.current.select("hub"));
    act(() => result.current.clear());

    expect(result.current.selectedId).toBeNull();
    expect(result.current.neighbourIds.size).toBe(0);
    expect(result.current.nodeEmphasis("west")).toBe("normal");
  });

  it("drops a selection whose node is no longer in the graph", () => {
    const { result, rerender } = renderHook(
      ({ currentAdjacency }) => useGraphSelection(currentAdjacency),
      { initialProps: { currentAdjacency: adjacency } },
    );

    act(() => result.current.select("far"));
    rerender({ currentAdjacency: { hub: [] } });

    expect(result.current.selectedId).toBeNull();
    expect(result.current.nodeEmphasis("hub")).toBe("normal");
  });
});
