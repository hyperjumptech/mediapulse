import {
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

import {
  findNearestGraphNode,
  graphDirectionForKey,
  graphShortcutForKey,
  type GraphNavigableNode,
} from "@/components/detail-blocks/graph/graph-navigation";

export const GRAPH_NODE_ID_ATTRIBUTE = "data-graph-node-id";

export type UseGraphKeyboardOptions<Node extends GraphNavigableNode> = {
  nodes: readonly Node[];
  initialActiveId: string | null;
  svgRef: RefObject<SVGSVGElement | null>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReveal: (node: Node) => void;
};

export type UseGraphKeyboardResult = {
  activeId: string | null;
  setActiveId: (id: string) => void;
  focusNode: (id: string) => void;
  handleNodeFocus: (event: FocusEvent<SVGGElement>, id: string) => void;
  handleNodeKeyDown: (event: KeyboardEvent<SVGGElement>, id: string) => void;
  handleFrameKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

const findNodeElement = (
  svg: SVGSVGElement | null,
  id: string,
): SVGGElement | undefined => {
  if (!svg) {
    return undefined;
  }
  const candidates = svg.querySelectorAll<SVGGElement>(
    `[${GRAPH_NODE_ID_ATTRIBUTE}]`,
  );

  return [...candidates].find(
    (element) => element.getAttribute(GRAPH_NODE_ID_ATTRIBUTE) === id,
  );
};

const isKeyboardFocus = (element: Element): boolean => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

export const useGraphKeyboard = <Node extends GraphNavigableNode>({
  nodes,
  initialActiveId,
  svgRef,
  selectedId,
  onSelect,
  onClear,
  onZoomIn,
  onZoomOut,
  onFit,
  onReveal,
}: UseGraphKeyboardOptions<Node>): UseGraphKeyboardResult => {
  const [storedActiveId, setActiveId] = useState<string | null>(
    initialActiveId,
  );
  const hasStoredNode =
    storedActiveId !== null && nodes.some((node) => node.id === storedActiveId);
  const fallbackActiveId = initialActiveId ?? nodes[0]?.id ?? null;
  const activeId = hasStoredNode ? storedActiveId : fallbackActiveId;

  const revealNode = (id: string) => {
    const node = nodes.find((candidate) => candidate.id === id);
    if (node) {
      onReveal(node);
    }
  };

  const focusNode = (id: string) => {
    setActiveId(id);
    findNodeElement(svgRef.current, id)?.focus({ preventScroll: true });
    revealNode(id);
  };

  const handleNodeFocus = (event: FocusEvent<SVGGElement>, id: string) => {
    setActiveId(id);
    if (isKeyboardFocus(event.currentTarget)) {
      revealNode(id);
    }
  };

  const handleNodeKeyDown = (event: KeyboardEvent<SVGGElement>, id: string) => {
    const direction = graphDirectionForKey(event.key);
    if (direction !== null) {
      event.preventDefault();
      const nearest = findNearestGraphNode(nodes, id, direction);
      if (nearest) {
        focusNode(nearest.id);
      }

      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveId(id);
      onSelect(id);
    }
  };

  const handleFrameKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const shortcut = graphShortcutForKey(event.key);
    if (shortcut === null) {
      return;
    }
    if (shortcut === "clear") {
      if (selectedId === null) {
        return;
      }
      event.preventDefault();
      onClear();
      focusNode(selectedId);

      return;
    }
    event.preventDefault();
    if (shortcut === "zoom-in") {
      onZoomIn();
    } else if (shortcut === "zoom-out") {
      onZoomOut();
    } else {
      onFit();
    }
  };

  return {
    activeId,
    setActiveId,
    focusNode,
    handleNodeFocus,
    handleNodeKeyDown,
    handleFrameKeyDown,
  };
};
