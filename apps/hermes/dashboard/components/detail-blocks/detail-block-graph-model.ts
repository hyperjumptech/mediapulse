import {
  renderUrlTemplate,
  resolvePath,
  type DetailBlockGraph,
  type DetailBlockGraphPaletteSlot,
} from "@hermes/domain-contract";

export type GraphModelNode = {
  id: string;
  label: string;
  group?: string;
  tooltip?: string;
  href?: string;
  external: boolean;
  emphasis: boolean;
  rank: number;
  slot: DetailBlockGraphPaletteSlot;
};

export type GraphModelEdge = {
  key: string;
  source: string;
  target: string;
  label?: string;
};

export type GraphModel = {
  nodes: GraphModelNode[];
  edges: GraphModelEdge[];
  groups: string[];
  totalNodes: number;
  droppedNodes: number;
  droppedEdges: number;
};

const ROTATING_SLOTS: DetailBlockGraphPaletteSlot[] = [
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
];

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const asId = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value);

  return text.length === 0 ? undefined : text;
};

const asOptionalText = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value);

  return text.length === 0 ? undefined : text;
};

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
};

type RawNode = {
  id: string;
  label: string;
  group?: string;
  tooltip?: string;
  href?: string;
  external: boolean;
  emphasis: boolean;
  explicitRank?: number;
  order?: number;
};

const readNodes = (
  block: DetailBlockGraph,
  data: unknown,
): { raw: RawNode[]; totalNodes: number; droppedNodes: number } => {
  const entries = asArray(resolvePath(data, block.nodesField));
  const seen = new Set<string>();
  const kept: RawNode[] = [];

  for (const entry of entries) {
    const id = asId(resolvePath(entry, block.node.idField));
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);

    const linkNamespace =
      typeof entry === "object" && entry !== null
        ? { ...(data as object), ...entry, node: entry }
        : { ...(data as object), node: entry };
    const href = block.node.linkTemplate
      ? renderUrlTemplate(block.node.linkTemplate, linkNamespace)
      : undefined;

    kept.push({
      id,
      label: asOptionalText(resolvePath(entry, block.node.labelField)) ?? id,
      group: block.node.groupField
        ? asOptionalText(resolvePath(entry, block.node.groupField))
        : undefined,
      tooltip: block.node.tooltipField
        ? asOptionalText(resolvePath(entry, block.node.tooltipField))
        : undefined,
      href,
      external: block.node.linkExternal === true,
      emphasis: block.node.emphasisField
        ? resolvePath(entry, block.node.emphasisField) === true
        : false,
      explicitRank: block.node.rankField
        ? asFiniteNumber(resolvePath(entry, block.node.rankField))
        : undefined,
      order: block.node.orderField
        ? asFiniteNumber(resolvePath(entry, block.node.orderField))
        : undefined,
    });
  }

  const totalNodes = kept.length;

  return {
    raw: kept.slice(0, block.maxNodes),
    totalNodes,
    droppedNodes: Math.max(0, totalNodes - block.maxNodes),
  };
};

const readEdges = (
  block: DetailBlockGraph,
  data: unknown,
  nodeIds: ReadonlySet<string>,
): { edges: GraphModelEdge[]; droppedEdges: number } => {
  const entries = asArray(resolvePath(data, block.edgesField));
  const seen = new Set<string>();
  const edges: GraphModelEdge[] = [];
  let droppedEdges = 0;

  for (const entry of entries) {
    const source = asId(resolvePath(entry, block.edge.sourceField));
    const target = asId(resolvePath(entry, block.edge.targetField));
    if (source === undefined || target === undefined) {
      droppedEdges += 1;
      continue;
    }
    if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) {
      droppedEdges += 1;
      continue;
    }

    const label = block.edge.labelField
      ? asOptionalText(resolvePath(entry, block.edge.labelField))
      : undefined;
    const key = `${source}->${target}->${label ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    edges.push({ key, source, target, label });
  }

  return { edges, droppedEdges };
};

const deriveRanks = (
  raw: readonly RawNode[],
  edges: readonly GraphModelEdge[],
): Map<string, number> => {
  const ranks = new Map<string, number>();
  if (raw.every((node) => node.explicitRank !== undefined)) {
    for (const node of raw) {
      ranks.set(node.id, node.explicitRank ?? 0);
    }

    return ranks;
  }

  const outgoing = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of raw) {
    outgoing.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    outgoing.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const derived = new Map<string, number>();
  const queue: string[] = [];
  for (const node of raw) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      derived.set(node.id, 0);
      queue.push(node.id);
    }
  }

  const rankCeiling = raw.length;
  let cursor = 0;
  while (cursor < queue.length) {
    const currentId = queue[cursor];
    cursor += 1;
    if (currentId === undefined) continue;
    const currentRank = derived.get(currentId) ?? 0;
    for (const nextId of outgoing.get(currentId) ?? []) {
      const candidate = currentRank + 1;
      if (candidate > rankCeiling) continue;
      if (candidate <= (derived.get(nextId) ?? -1)) continue;
      derived.set(nextId, candidate);
      queue.push(nextId);
    }
  }

  const maxDerived = [...derived.values()].reduce(
    (highest, rank) => Math.max(highest, rank),
    0,
  );
  for (const node of raw) {
    const explicit = node.explicitRank;
    if (explicit !== undefined) {
      ranks.set(node.id, explicit);
      continue;
    }
    ranks.set(node.id, derived.get(node.id) ?? maxDerived + 1);
  }

  return ranks;
};

const assignSlots = (
  groups: readonly string[],
  groupVariants: DetailBlockGraph["groupVariants"],
): Map<string, DetailBlockGraphPaletteSlot> => {
  const slots = new Map<string, DetailBlockGraphPaletteSlot>();
  let rotation = 0;
  for (const group of groups) {
    const declared = groupVariants?.[group];
    if (declared) {
      slots.set(group, declared);
      continue;
    }
    const slot = ROTATING_SLOTS[rotation % ROTATING_SLOTS.length];
    rotation += 1;
    slots.set(group, slot ?? "neutral");
  }

  return slots;
};

export const buildGraphModel = (
  block: DetailBlockGraph,
  data: unknown,
): GraphModel => {
  const { raw, totalNodes, droppedNodes } = readNodes(block, data);
  const nodeIds = new Set(raw.map((node) => node.id));
  const { edges, droppedEdges } = readEdges(block, data, nodeIds);
  const ranks = deriveRanks(raw, edges);

  const groups: string[] = [];
  for (const node of raw) {
    if (node.group !== undefined && !groups.includes(node.group)) {
      groups.push(node.group);
    }
  }
  const slots = assignSlots(groups, block.groupVariants);

  const nodes = raw
    .map((node, index) => ({
      node,
      index,
      rank: ranks.get(node.id) ?? 0,
    }))
    .sort((first, second) => {
      if (first.rank !== second.rank) return first.rank - second.rank;
      const firstOrder = first.node.order;
      const secondOrder = second.node.order;
      if (firstOrder !== undefined && secondOrder !== undefined) {
        if (firstOrder !== secondOrder) return firstOrder - secondOrder;
      }

      return first.index - second.index;
    })
    .map(({ node, rank }) => ({
      id: node.id,
      label: node.label,
      group: node.group,
      tooltip: node.tooltip,
      href: node.href,
      external: node.external,
      emphasis: node.emphasis,
      rank,
      slot: node.group ? (slots.get(node.group) ?? "neutral") : "neutral",
    }));

  return { nodes, edges, groups, totalNodes, droppedNodes, droppedEdges };
};
