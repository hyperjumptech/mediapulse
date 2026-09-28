export type GraphDirection = "up" | "down" | "left" | "right";

export type GraphShortcut = "zoom-in" | "zoom-out" | "fit" | "clear";

export type GraphNavigableNode = {
  id: string;
  x: number;
  y: number;
};

const DIRECTION_BY_KEY: Record<string, GraphDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const SHORTCUT_BY_KEY: Record<string, GraphShortcut> = {
  "+": "zoom-in",
  "=": "zoom-in",
  "-": "zoom-out",
  "0": "fit",
  Escape: "clear",
};

const DIRECTION_VECTOR: Record<GraphDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const CROSS_AXIS_PENALTY = 2;

export const graphDirectionForKey = (key: string): GraphDirection | null =>
  DIRECTION_BY_KEY[key] ?? null;

export const graphShortcutForKey = (key: string): GraphShortcut | null =>
  SHORTCUT_BY_KEY[key] ?? null;

export const findNearestGraphNode = <Node extends GraphNavigableNode>(
  nodes: readonly Node[],
  fromId: string,
  direction: GraphDirection,
): Node | null => {
  const origin = nodes.find((node) => node.id === fromId);
  if (!origin) {
    return null;
  }
  const vector = DIRECTION_VECTOR[direction];
  let nearest: Node | null = null;
  let nearestScore = Number.POSITIVE_INFINITY;
  for (const candidate of nodes) {
    if (candidate.id === fromId) {
      continue;
    }
    const offsetX = candidate.x - origin.x;
    const offsetY = candidate.y - origin.y;
    const along = offsetX * vector.x + offsetY * vector.y;
    if (along <= 0) {
      continue;
    }
    const across = Math.abs(offsetX * vector.y - offsetY * vector.x);
    const score = along + across * CROSS_AXIS_PENALTY;
    if (score < nearestScore) {
      nearest = candidate;
      nearestScore = score;
    }
  }

  return nearest;
};
