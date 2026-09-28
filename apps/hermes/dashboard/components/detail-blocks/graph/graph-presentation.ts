import type { DetailBlockGraphPaletteSlot } from "@hermes/domain-contract";

export const GRAPH_LABEL_MAX_CHARACTERS = 24;
export const GRAPH_COMPACT_ZOOM = 0.7;
export const GRAPH_DETAILED_ZOOM = 1.2;
export const GRAPH_DIMMED_OPACITY = 0.2;

export type GraphZoomLevel = "compact" | "normal" | "detailed";

export type GraphNodeEmphasis = "selected" | "neighbour" | "dimmed" | "normal";

export type GraphEdgeEmphasis = "highlighted" | "dimmed" | "normal";

export const GRAPH_SLOT_COLOR: Record<DetailBlockGraphPaletteSlot, string> = {
  accent1: "var(--chart-1)",
  accent2: "var(--chart-2)",
  accent3: "var(--chart-3)",
  accent4: "var(--chart-4)",
  accent5: "var(--chart-5)",
  neutral: "var(--muted-foreground)",
};

export const graphZoomLevelFor = (scale: number): GraphZoomLevel => {
  if (scale < GRAPH_COMPACT_ZOOM) {
    return "compact";
  }

  return scale >= GRAPH_DETAILED_ZOOM ? "detailed" : "normal";
};

export const truncateGraphLabel = (
  label: string,
  maxCharacters: number = GRAPH_LABEL_MAX_CHARACTERS,
): string => {
  const normalized = label.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  return `${normalized.slice(0, maxCharacters - 1).trimEnd()}…`;
};

export const describeGraphNode = (node: {
  label: string;
  group?: string;
  degree: number;
}): string => {
  const connectionNoun = node.degree === 1 ? "connection" : "connections";
  const connections = `${String(node.degree)} ${connectionNoun}`;
  const parts = [node.label, node.group, connections].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );

  return parts.join(", ");
};

export const GRAPH_ALWAYS_LABELLED_RANK = 1;

export const isGraphNodeLabelVisible = ({
  level,
  emphasis,
  isFocus,
  rank,
}: {
  level: GraphZoomLevel;
  emphasis: GraphNodeEmphasis;
  isFocus: boolean;
  rank: number;
}): boolean => {
  if (isFocus || emphasis === "selected" || emphasis === "neighbour") {
    return true;
  }
  if (level === "detailed") {
    return true;
  }

  return level === "normal" && rank <= GRAPH_ALWAYS_LABELLED_RANK;
};

export const isGraphEdgeLabelVisible = ({
  level,
  emphasis,
}: {
  level: GraphZoomLevel;
  emphasis: GraphEdgeEmphasis;
}): boolean => level === "detailed" || emphasis === "highlighted";
