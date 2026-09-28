import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import type {
  GraphModel,
  GraphModelEdge,
  GraphModelNode,
} from "../detail-block-graph-model";

export const GRAPH_RING_RADIUS = 160;
export const GRAPH_SIMULATION_TICKS = 300;
export const GRAPH_LABEL_PADDING_X = 80;
export const GRAPH_LABEL_PADDING_Y = 36;

export type GraphSceneNode = GraphModelNode & {
  x: number;
  y: number;
  radius: number;
  degree: number;
};

export type GraphSceneEdge = GraphModelEdge & {
  curved: boolean;
  bend: number;
};

export type GraphSceneBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};

export type GraphScene = {
  nodes: GraphSceneNode[];
  edges: GraphSceneEdge[];
  adjacency: Record<string, string[]>;
  bounds: GraphSceneBounds;
  focusId: string | null;
};

type SimulationNode = SimulationNodeDatum & {
  id: string;
  rank: number;
  radius: number;
};

type SimulationLink = SimulationLinkDatum<SimulationNode> & {
  rankGap: number;
};

const hashText = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash;
};

export const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;

    return state / 4294967296;
  };
};

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

const nodeRadius = (node: GraphModelNode, degree: number) =>
  node.emphasis ? 14 : 8 + Math.min(degree, 6);

const buildAdjacency = (
  nodes: GraphModelNode[],
  edges: GraphModelEdge[],
): Record<string, string[]> => {
  const adjacency: Record<string, string[]> = Object.fromEntries(
    nodes.map((node) => [node.id, []]),
  );
  for (const edge of edges) {
    const fromSource = adjacency[edge.source];
    const fromTarget = adjacency[edge.target];
    if (fromSource && !fromSource.includes(edge.target)) {
      fromSource.push(edge.target);
    }
    if (fromTarget && !fromTarget.includes(edge.source)) {
      fromTarget.push(edge.source);
    }
  }

  return adjacency;
};

const pickFocusId = (nodes: GraphModelNode[]): string | null =>
  nodes.find((node) => node.emphasis)?.id ??
  nodes.find((node) => node.rank === 0)?.id ??
  nodes[0]?.id ??
  null;

const seedPositions = (
  nodes: GraphModelNode[],
  edges: GraphModelEdge[],
  focusId: string | null,
  random: () => number,
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  const angles = new Map<string, number>();
  const parentOf = new Map<string, string>();
  for (const edge of edges) {
    if (!parentOf.has(edge.target)) {
      parentOf.set(edge.target, edge.source);
    }
  }
  const ranks = [...new Set(nodes.map((node) => node.rank))].sort(
    (left, right) => left - right,
  );
  for (const rank of ranks) {
    const ringNodes = nodes.filter((node) => node.rank === rank);
    ringNodes.forEach((node, index) => {
      if (node.id === focusId) {
        positions.set(node.id, { x: 0, y: 0 });
        angles.set(node.id, 0);

        return;
      }
      const parentAngle = angles.get(parentOf.get(node.id) ?? "");
      const spreadAngle = (index / Math.max(ringNodes.length, 1)) * Math.PI * 2;
      const jitter = (random() - 0.5) * 0.6;
      const angle = (parentAngle ?? spreadAngle) + jitter;
      const radius = Math.max(rank, 1) * GRAPH_RING_RADIUS;
      angles.set(node.id, angle);
      positions.set(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });
  }

  return positions;
};

const SINGLE_CURVE_BEND = 0.5;

const pairKey = (edge: GraphModelEdge) =>
  edge.source < edge.target
    ? `${edge.source}\u0000${edge.target}`
    : `${edge.target}\u0000${edge.source}`;

const bendEdges = (
  edges: GraphModelEdge[],
  rankById: Map<string, number>,
): GraphSceneEdge[] => {
  const pairs = new Map<string, GraphModelEdge[]>();
  for (const edge of edges) {
    const key = pairKey(edge);
    pairs.set(key, [...(pairs.get(key) ?? []), edge]);
  }

  return edges.map((edge) => {
    const siblings = pairs.get(pairKey(edge)) ?? [edge];
    const sameRank = rankById.get(edge.source) === rankById.get(edge.target);
    const canonicalOffset =
      siblings.length === 1
        ? sameRank
          ? SINGLE_CURVE_BEND
          : 0
        : siblings.indexOf(edge) - (siblings.length - 1) / 2;
    const bend = edge.source < edge.target ? canonicalOffset : -canonicalOffset;

    return { ...edge, curved: bend !== 0, bend: bend === 0 ? 0 : bend };
  });
};

const measureBounds = (nodes: GraphSceneNode[]): GraphSceneBounds => {
  if (nodes.length === 0) {
    return { minX: -100, minY: -60, width: 200, height: 120 };
  }
  const minX =
    Math.min(...nodes.map((node) => node.x - node.radius)) -
    GRAPH_LABEL_PADDING_X;
  const maxX =
    Math.max(...nodes.map((node) => node.x + node.radius)) +
    GRAPH_LABEL_PADDING_X;
  const minY =
    Math.min(...nodes.map((node) => node.y - node.radius)) -
    GRAPH_LABEL_PADDING_Y;
  const maxY =
    Math.max(...nodes.map((node) => node.y + node.radius)) +
    GRAPH_LABEL_PADDING_Y;

  return {
    minX: roundToTenth(minX),
    minY: roundToTenth(minY),
    width: roundToTenth(maxX - minX),
    height: roundToTenth(maxY - minY),
  };
};

export const buildGraphScene = (model: GraphModel): GraphScene => {
  const adjacency = buildAdjacency(model.nodes, model.edges);
  const focusId = pickFocusId(model.nodes);
  const random = createSeededRandom(
    hashText(model.nodes.map((node) => node.id).join("|")),
  );
  const seeds = seedPositions(model.nodes, model.edges, focusId, random);
  const rankById = new Map(model.nodes.map((node) => [node.id, node.rank]));
  const simulationNodes: SimulationNode[] = model.nodes.map((node) => {
    const seed = seeds.get(node.id) ?? { x: 0, y: 0 };
    const isFocus = node.id === focusId;

    return {
      id: node.id,
      rank: node.rank,
      radius: nodeRadius(node, adjacency[node.id]?.length ?? 0),
      x: seed.x,
      y: seed.y,
      fx: isFocus ? 0 : undefined,
      fy: isFocus ? 0 : undefined,
    };
  });
  const simulationLinks: SimulationLink[] = model.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    rankGap: Math.abs(
      (rankById.get(edge.source) ?? 0) - (rankById.get(edge.target) ?? 0),
    ),
  }));

  const simulation = forceSimulation(simulationNodes)
    .randomSource(random)
    .force(
      "link",
      forceLink<SimulationNode, SimulationLink>(simulationLinks)
        .id((node) => node.id)
        .distance((link) =>
          link.rankGap === 0 ? 120 : 90 + 30 * link.rankGap,
        ),
    )
    .force("charge", forceManyBody<SimulationNode>().strength(-320))
    .force(
      "collide",
      forceCollide<SimulationNode>().radius((node) => node.radius + 22),
    )
    .force(
      "radial",
      forceRadial<SimulationNode>(
        (node) => node.rank * GRAPH_RING_RADIUS,
        0,
        0,
      ).strength(0.15),
    )
    .stop();
  simulation.tick(GRAPH_SIMULATION_TICKS);

  const placedById = new Map(simulationNodes.map((node) => [node.id, node]));
  const nodes: GraphSceneNode[] = model.nodes.map((node) => {
    const placed = placedById.get(node.id);

    return {
      ...node,
      x: roundToTenth(placed?.x ?? 0),
      y: roundToTenth(placed?.y ?? 0),
      radius: placed?.radius ?? nodeRadius(node, 0),
      degree: adjacency[node.id]?.length ?? 0,
    };
  });

  return {
    nodes,
    edges: bendEdges(model.edges, rankById),
    adjacency,
    bounds: measureBounds(nodes),
    focusId,
  };
};
