export const GRAPH_NODE_WIDTH = 220;
export const GRAPH_NODE_HEIGHT = 44;
export const GRAPH_RANK_GAP = 96;
export const GRAPH_SIBLING_GAP = 14;
export const GRAPH_PADDING = 24;
export const GRAPH_LABEL_MAX_CHARS = 30;
export const GRAPH_LABEL_MAX_LINES = 2;

export type GraphOrientation = "horizontal" | "vertical";

export type GraphRankedNode = {
  id: string;
  rank: number;
};

export type GraphPlacedNode = GraphRankedNode & {
  x: number;
  y: number;
};

export type GraphPlacement = {
  placed: GraphPlacedNode[];
  width: number;
  height: number;
};

export type GraphEdgeGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  path: string;
  midX: number;
  midY: number;
};

const groupIdsByRank = (
  nodes: readonly GraphRankedNode[],
): { ranks: number[]; idsAt: (rank: number) => string[] } => {
  const byRank = new Map<number, string[]>();
  for (const node of nodes) {
    const bucket = byRank.get(node.rank);
    if (bucket) {
      bucket.push(node.id);
      continue;
    }
    byRank.set(node.rank, [node.id]);
  }
  const ranks = [...byRank.keys()].sort((first, second) => first - second);

  return { ranks, idsAt: (rank: number) => byRank.get(rank) ?? [] };
};

export const placeGraphNodes = (
  nodes: readonly GraphRankedNode[],
  orientation: GraphOrientation,
): GraphPlacement => {
  if (nodes.length === 0) {
    return { placed: [], width: 0, height: 0 };
  }

  const { ranks, idsAt } = groupIdsByRank(nodes);
  const isHorizontal = orientation === "horizontal";
  const alongSize = isHorizontal ? GRAPH_NODE_WIDTH : GRAPH_NODE_HEIGHT;
  const acrossSize = isHorizontal ? GRAPH_NODE_HEIGHT : GRAPH_NODE_WIDTH;
  const rankPitch = alongSize + GRAPH_RANK_GAP;
  const siblingPitch = acrossSize + GRAPH_SIBLING_GAP;
  const widestRankCount = ranks.reduce(
    (widest, rank) => Math.max(widest, idsAt(rank).length),
    0,
  );
  const innerAcross = widestRankCount * siblingPitch - GRAPH_SIBLING_GAP;
  const innerAlong = ranks.length * rankPitch - GRAPH_RANK_GAP;

  const placed: GraphPlacedNode[] = [];
  ranks.forEach((rank, rankIndex) => {
    const ids = idsAt(rank);
    const span = ids.length * siblingPitch - GRAPH_SIBLING_GAP;
    const acrossStart = GRAPH_PADDING + (innerAcross - span) / 2;
    ids.forEach((id, indexInRank) => {
      const alongPosition = GRAPH_PADDING + rankIndex * rankPitch;
      const acrossPosition = acrossStart + indexInRank * siblingPitch;
      placed.push(
        isHorizontal
          ? { id, rank, x: alongPosition, y: acrossPosition }
          : { id, rank, x: acrossPosition, y: alongPosition },
      );
    });
  });

  return {
    placed,
    width: GRAPH_PADDING * 2 + (isHorizontal ? innerAlong : innerAcross),
    height: GRAPH_PADDING * 2 + (isHorizontal ? innerAcross : innerAlong),
  };
};

export const buildEdgeGeometry = (
  from: GraphPlacedNode,
  to: GraphPlacedNode,
  orientation: GraphOrientation,
): GraphEdgeGeometry => {
  const isHorizontal = orientation === "horizontal";
  const x1 = isHorizontal
    ? from.x + GRAPH_NODE_WIDTH
    : from.x + GRAPH_NODE_WIDTH / 2;
  const y1 = isHorizontal
    ? from.y + GRAPH_NODE_HEIGHT / 2
    : from.y + GRAPH_NODE_HEIGHT;
  const x2 = isHorizontal ? to.x : to.x + GRAPH_NODE_WIDTH / 2;
  const y2 = isHorizontal ? to.y + GRAPH_NODE_HEIGHT / 2 : to.y;

  const path = isHorizontal
    ? `M ${x1} ${y1} C ${x1 + (x2 - x1) / 2} ${y1}, ${x2 - (x2 - x1) / 2} ${y2}, ${x2} ${y2}`
    : `M ${x1} ${y1} C ${x1} ${y1 + (y2 - y1) / 2}, ${x2} ${y2 - (y2 - y1) / 2}, ${x2} ${y2}`;

  return {
    x1,
    y1,
    x2,
    y2,
    path,
    midX: (x1 + x2) / 2,
    midY: (y1 + y2) / 2,
  };
};

export const wrapGraphLabel = (
  label: string,
  maxChars: number = GRAPH_LABEL_MAX_CHARS,
  maxLines: number = GRAPH_LABEL_MAX_LINES,
): string[] => {
  const normalized = label.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  let consumedWords = 0;

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      consumedWords += 1;
      continue;
    }
    if (current.length > 0) {
      lines.push(current);
    }
    if (lines.length === maxLines) {
      current = "";
      break;
    }
    current = word.length > maxChars ? word.slice(0, maxChars) : word;
    consumedWords += 1;
  }

  if (lines.length < maxLines && current.length > 0) {
    lines.push(current);
  }

  const truncated =
    consumedWords < words.length || lines.join(" ") !== normalized;
  if (truncated && lines.length > 0) {
    const lastLine = lines[lines.length - 1] ?? "";
    const room = Math.max(0, maxChars - 1);
    lines[lines.length - 1] = `${lastLine.slice(0, room).trimEnd()}…`;
  }

  return lines;
};
