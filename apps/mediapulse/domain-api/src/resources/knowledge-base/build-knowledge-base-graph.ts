import { graphGroupForKind, truncateTitle } from "./knowledge-base-labels";

/**
 * Entities drawn in the entity layer before the rest become one overflow node.
 *
 * - Important: these caps decide the drawing's height, not just its size. Every rank is centred
 *   against the tallest one, so a long article layer pushes the issuer node to the vertical middle
 *   and out of the frame. The counts below keep the whole graph inside one screen; the tabs below it
 *   carry the rest.
 */
export const KB_GRAPH_ENTITY_CAP = 10;

/** Articles drawn under one entity. */
export const KB_GRAPH_ARTICLES_PER_ENTITY = 2;

/** Articles drawn across the whole graph, whatever the per-entity allowance permits. */
export const KB_GRAPH_TOTAL_ARTICLE_CAP = 20;

export const KB_GRAPH_RANK_TICKER = 0;
export const KB_GRAPH_RANK_ENTITY = 1;
export const KB_GRAPH_RANK_ARTICLE = 2;

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  group: string;
  tooltip: string | null;
  rank: number;
  order: number;
  emphasis: boolean;
  linkResource: string | null;
  linkId: string | null;
};

export type KnowledgeGraphEdge = {
  source: string;
  target: string;
  label: string | null;
};

export type KnowledgeGraphPayload = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  truncated: boolean;
  truncatedLabel: string;
};

export type GraphEntityInput = {
  entityId: string;
  canonicalName: string;
  kind: string;
  isIssuer: boolean;
  mentionCount: number;
  sourceLabel: string;
  /** The spelling this ticker's articles use most, when it differs from the label. */
  surfaceForm: string | null;
  articles: {
    dataSourceId: string;
    title: string | null;
    url: string;
    publisher: string | null;
  }[];
};

export type GraphRelationInput = {
  subjectEntityId: string;
  objectEntityId: string;
  label: string;
  inverseLabel: string | null;
};

export type BuildKnowledgeBaseGraphInput = {
  ticker: {
    tickerId: string;
    symbol: string;
    name: string;
  };
  entities: GraphEntityInput[];
  relations: GraphRelationInput[];
  totals: {
    entityCount: number;
    relationCount: number;
    articleCount: number;
  };
};

const tickerNodeId = (tickerId: string): string => `ticker:${tickerId}`;
const entityNodeId = (entityId: string): string => `entity:${entityId}`;
const articleNodeId = (dataSourceId: string): string =>
  `article:${dataSourceId}`;

/**
 * Draws one ticker's knowledge base as a three-layer graph.
 *
 * - Important: only rank-crossing edges are drawn. Two entities sit in the same rank, and the
 *   renderer's horizontal edge starts at the source node's right edge and ends at the target's left,
 *   so a same-rank edge would run backwards through both boxes. Entity-to-entity relations are
 *   reported in the caption and listed in the Relations tab instead.
 *
 * @param input - The issuer, its entities with their articles, and the relations between them.
 * @returns Nodes, edges, and what was left undrawn.
 */
export function buildKnowledgeBaseGraph(
  input: BuildKnowledgeBaseGraphInput,
): KnowledgeGraphPayload {
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const notes: string[] = [];

  const issuerNodeId = tickerNodeId(input.ticker.tickerId);
  nodes.push({
    id: issuerNodeId,
    label: input.ticker.symbol,
    group: "ticker",
    tooltip: `${input.ticker.name} · ${String(input.totals.entityCount)} entities · ${String(input.totals.relationCount)} relations · ${String(input.totals.articleCount)} articles`,
    rank: KB_GRAPH_RANK_TICKER,
    order: 0,
    emphasis: true,
    linkResource: null,
    linkId: null,
  });

  // The issuer's own entity is this node. Drawing it again in the entity layer would put the issuer
  // on the graph twice.
  const issuerEntity = input.entities.find((entity) => entity.isIssuer);
  const others = input.entities.filter((entity) => !entity.isIssuer);
  const drawn = others.slice(0, KB_GRAPH_ENTITY_CAP);
  const undrawn = others.length - drawn.length;
  if (undrawn > 0) {
    notes.push(`${String(undrawn)} more entities not drawn.`);
  }

  const drawnEntityIds = new Set(drawn.map((entity) => entity.entityId));
  const labelFor = new Map<string, { label: string; inverse: string | null }>();
  let betweenEntities = 0;
  for (const relation of input.relations) {
    const fromIssuer =
      issuerEntity !== undefined &&
      relation.subjectEntityId === issuerEntity.entityId;
    const toIssuer =
      issuerEntity !== undefined &&
      relation.objectEntityId === issuerEntity.entityId;

    if (fromIssuer && drawnEntityIds.has(relation.objectEntityId)) {
      labelFor.set(relation.objectEntityId, {
        label: relation.label,
        inverse: relation.inverseLabel,
      });

      continue;
    }
    if (toIssuer && drawnEntityIds.has(relation.subjectEntityId)) {
      labelFor.set(relation.subjectEntityId, {
        label: relation.inverseLabel ?? relation.label,
        inverse: null,
      });

      continue;
    }
    if (
      drawnEntityIds.has(relation.subjectEntityId) &&
      drawnEntityIds.has(relation.objectEntityId)
    ) {
      betweenEntities += 1;
    }
  }
  if (betweenEntities > 0) {
    notes.push(
      `${String(betweenEntities)} relations between entities are listed below rather than drawn.`,
    );
  }

  let articleBudget = KB_GRAPH_TOTAL_ARTICLE_CAP;

  drawn.forEach((entity, entityIndex) => {
    const seenAs =
      entity.surfaceForm !== null && entity.surfaceForm !== entity.canonicalName
        ? ` · seen as ${entity.surfaceForm}`
        : "";
    nodes.push({
      id: entityNodeId(entity.entityId),
      label: entity.canonicalName,
      group: graphGroupForKind(entity.kind),
      tooltip: `${entity.sourceLabel} · ${String(entity.mentionCount)} articles${seenAs}`,
      rank: KB_GRAPH_RANK_ENTITY,
      order: entityIndex,
      emphasis: false,
      linkResource: null,
      linkId: null,
    });
    edges.push({
      source: issuerNodeId,
      target: entityNodeId(entity.entityId),
      label: labelFor.get(entity.entityId)?.label ?? null,
    });

    const articles = entity.articles.slice(
      0,
      Math.min(KB_GRAPH_ARTICLES_PER_ENTITY, Math.max(articleBudget, 0)),
    );
    articles.forEach((article, articleIndex) => {
      nodes.push({
        id: articleNodeId(article.dataSourceId),
        label: truncateTitle(article.title ?? article.url),
        group: "article",
        tooltip: `${article.publisher ?? "Unknown publisher"} · ${article.url}`,
        rank: KB_GRAPH_RANK_ARTICLE,
        order: entityIndex * 1000 + articleIndex,
        emphasis: false,
        linkResource: "data-sources",
        linkId: article.dataSourceId,
      });
      edges.push({
        source: entityNodeId(entity.entityId),
        target: articleNodeId(article.dataSourceId),
        label: null,
      });
    });
    articleBudget -= articles.length;

    const hiddenArticles = entity.mentionCount - articles.length;
    if (hiddenArticles > 0) {
      const overflowId = `article:overflow:${entity.entityId}`;
      nodes.push({
        id: overflowId,
        label: `+${String(hiddenArticles)} more articles`,
        group: "overflow",
        tooltip: null,
        rank: KB_GRAPH_RANK_ARTICLE,
        order: entityIndex * 1000 + KB_GRAPH_ARTICLES_PER_ENTITY + 1,
        emphasis: false,
        linkResource: null,
        linkId: null,
      });
      edges.push({
        source: entityNodeId(entity.entityId),
        target: overflowId,
        label: null,
      });
    }
  });

  if (undrawn > 0) {
    nodes.push({
      id: "entity:overflow",
      label: `+${String(undrawn)} more entities`,
      group: "overflow",
      tooltip: null,
      rank: KB_GRAPH_RANK_ENTITY,
      order: KB_GRAPH_ENTITY_CAP + 1,
      emphasis: false,
      linkResource: null,
      linkId: null,
    });
    edges.push({
      source: issuerNodeId,
      target: "entity:overflow",
      label: null,
    });
  }

  // Dedup by id, because two entities can cite one article and a node may only appear once.
  const seen = new Set<string>();
  const uniqueNodes = nodes.filter((node) => {
    if (seen.has(node.id)) {
      return false;
    }
    seen.add(node.id);

    return true;
  });

  return {
    nodes: uniqueNodes,
    edges,
    truncated: notes.length > 0,
    truncatedLabel: notes.join(" "),
  };
}
