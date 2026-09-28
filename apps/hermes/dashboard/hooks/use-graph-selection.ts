import { useCallback, useMemo, useState } from "react";

import type {
  GraphEdgeEmphasis,
  GraphNodeEmphasis,
} from "@/components/detail-blocks/graph/graph-presentation";

export type GraphSelectionEdge = {
  source: string;
  target: string;
};

export type UseGraphSelectionResult = {
  selectedId: string | null;
  neighbourIds: ReadonlySet<string>;
  select: (id: string) => void;
  clear: () => void;
  nodeEmphasis: (id: string) => GraphNodeEmphasis;
  edgeEmphasis: (edge: GraphSelectionEdge) => GraphEdgeEmphasis;
};

export const useGraphSelection = (
  adjacency: Readonly<Record<string, readonly string[]>>,
): UseGraphSelectionResult => {
  const [storedId, setStoredId] = useState<string | null>(null);
  const selectedId =
    storedId !== null && Object.hasOwn(adjacency, storedId) ? storedId : null;
  const neighbourIds = useMemo(
    () => new Set(selectedId === null ? [] : (adjacency[selectedId] ?? [])),
    [adjacency, selectedId],
  );
  const select = useCallback((id: string) => setStoredId(id), []);
  const clear = useCallback(() => setStoredId(null), []);

  const nodeEmphasis = (id: string): GraphNodeEmphasis => {
    if (selectedId === null) {
      return "normal";
    }
    if (id === selectedId) {
      return "selected";
    }

    return neighbourIds.has(id) ? "neighbour" : "dimmed";
  };

  const edgeEmphasis = (edge: GraphSelectionEdge): GraphEdgeEmphasis => {
    if (selectedId === null) {
      return "normal";
    }
    const touchesSelection =
      edge.source === selectedId || edge.target === selectedId;

    return touchesSelection ? "highlighted" : "dimmed";
  };

  return {
    selectedId,
    neighbourIds,
    select,
    clear,
    nodeEmphasis,
    edgeEmphasis,
  };
};
