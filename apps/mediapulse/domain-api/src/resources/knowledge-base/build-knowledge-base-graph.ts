import {
  graphGroupForKind,
  kindLabel,
  truncateTitle,
} from "./knowledge-base-labels";

export const KB_GRAPH_ENTITY_CAP = 25;
export const KB_GRAPH_ARTICLES_PER_ENTITY = 3;
export const KB_GRAPH_TOTAL_ARTICLE_CAP = 50;

export const KB_GRAPH_RANK_TICKER = 0;
export const KB_GRAPH_RANK_ENTITY = 1;
export const KB_GRAPH_RANK_ARTICLE = 2;

export type KnowledgeGraphNodeDetails = {
  kindLabel: string | null;
  mentionCount: number | null;
  seenAs: string | null;
  sourceLabel: string | null;
  publisher: string | null;
  publishedAt: string | null;
  url: string | null;
};

export type KnowledgeGraphNode = KnowledgeGraphNodeDetails & {
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

export type GraphArticleInput = {
  dataSourceId: string;
  title: string | null;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
};

export type GraphEntityInput = {
  entityId: string;
  canonicalName: string;
  kind: string;
  isIssuer: boolean;
  mentionCount: number;
  sourceLabel: string;
  surfaceForm: string | null;
  aliases: string[];
  articles: GraphArticleInput[];
};

export type GraphRelationInput = {
  subjectEntityId: string;
  objectEntityId: string;
  label: string;
  inverseLabel: string | null;
  symmetric: boolean;
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

const NO_NODE_DETAILS: KnowledgeGraphNodeDetails = {
  kindLabel: null,
  mentionCount: null,
  seenAs: null,
  sourceLabel: null,
  publisher: null,
  publishedAt: null,
  url: null,
};

const tickerNodeId = (tickerId: string): string => `ticker:${tickerId}`;
const entityNodeId = (entityId: string): string => `entity:${entityId}`;
const articleNodeId = (dataSourceId: string): string =>
  `article:${dataSourceId}`;

const seenAsFor = (entity: GraphEntityInput): string | null => {
  const otherNames = [entity.surfaceForm, ...entity.aliases].filter(
    (name): name is string =>
      name !== null && name.length > 0 && name !== entity.canonicalName,
  );
  const distinctNames = [...new Set(otherNames)];

  return distinctNames.length === 0 ? null : distinctNames.join(", ");
};

const relationEdgeKeys = (relation: GraphRelationInput): string[] => {
  const forwardKey = `${relation.subjectEntityId}->${relation.objectEntityId}->${relation.label}`;
  const mirrorLabel = relation.symmetric
    ? relation.label
    : relation.inverseLabel;
  if (mirrorLabel === null) {
    return [forwardKey];
  }
  const mirrorKey = `${relation.objectEntityId}->${relation.subjectEntityId}->${mirrorLabel}`;

  return [forwardKey, mirrorKey];
};

export function buildKnowledgeBaseGraph(
  input: BuildKnowledgeBaseGraphInput,
): KnowledgeGraphPayload {
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const notes: string[] = [];

  const issuerNodeId = tickerNodeId(input.ticker.tickerId);
  nodes.push({
    ...NO_NODE_DETAILS,
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

  const issuerEntity = input.entities.find((entity) => entity.isIssuer);
  const others = input.entities.filter((entity) => !entity.isIssuer);
  const drawn = others.slice(0, KB_GRAPH_ENTITY_CAP);
  const undrawn = others.length - drawn.length;
  if (undrawn > 0) {
    notes.push(`${String(undrawn)} more entities not drawn.`);
  }

  const drawnEntityIds = new Set(drawn.map((entity) => entity.entityId));
  const issuerEdgeLabelFor = new Map<string, string>();
  const relationEdges: KnowledgeGraphEdge[] = [];
  const seenRelationKeys = new Set<string>();
  for (const relation of input.relations) {
    if (relation.subjectEntityId === relation.objectEntityId) {
      continue;
    }
    const fromIssuer =
      issuerEntity !== undefined &&
      relation.subjectEntityId === issuerEntity.entityId;
    const toIssuer =
      issuerEntity !== undefined &&
      relation.objectEntityId === issuerEntity.entityId;

    if (fromIssuer && drawnEntityIds.has(relation.objectEntityId)) {
      issuerEdgeLabelFor.set(relation.objectEntityId, relation.label);

      continue;
    }
    if (toIssuer && drawnEntityIds.has(relation.subjectEntityId)) {
      issuerEdgeLabelFor.set(
        relation.subjectEntityId,
        relation.inverseLabel ?? relation.label,
      );

      continue;
    }
    const bothEndsDrawn =
      drawnEntityIds.has(relation.subjectEntityId) &&
      drawnEntityIds.has(relation.objectEntityId);
    if (!bothEndsDrawn) {
      continue;
    }
    const keys = relationEdgeKeys(relation);
    if (keys.some((key) => seenRelationKeys.has(key))) {
      continue;
    }
    keys.forEach((key) => seenRelationKeys.add(key));
    relationEdges.push({
      source: entityNodeId(relation.subjectEntityId),
      target: entityNodeId(relation.objectEntityId),
      label: relation.label,
    });
  }

  let articleBudget = KB_GRAPH_TOTAL_ARTICLE_CAP;

  drawn.forEach((entity, entityIndex) => {
    const seenAs = seenAsFor(entity);
    const tooltipSeenAs =
      entity.surfaceForm !== null && entity.surfaceForm !== entity.canonicalName
        ? ` · seen as ${entity.surfaceForm}`
        : "";
    nodes.push({
      ...NO_NODE_DETAILS,
      id: entityNodeId(entity.entityId),
      label: entity.canonicalName,
      group: graphGroupForKind(entity.kind),
      tooltip: `${entity.sourceLabel} · ${String(entity.mentionCount)} articles${tooltipSeenAs}`,
      rank: KB_GRAPH_RANK_ENTITY,
      order: entityIndex,
      emphasis: false,
      linkResource: null,
      linkId: null,
      kindLabel: kindLabel(entity.kind),
      mentionCount: entity.mentionCount,
      seenAs,
      sourceLabel: entity.sourceLabel,
    });
    edges.push({
      source: issuerNodeId,
      target: entityNodeId(entity.entityId),
      label: issuerEdgeLabelFor.get(entity.entityId) ?? null,
    });

    const articleAllowance = Math.min(
      KB_GRAPH_ARTICLES_PER_ENTITY,
      Math.max(articleBudget, 0),
    );
    const articles = entity.articles.slice(0, articleAllowance);
    articles.forEach((article, articleIndex) => {
      nodes.push({
        ...NO_NODE_DETAILS,
        id: articleNodeId(article.dataSourceId),
        label: truncateTitle(article.title ?? article.url),
        group: "article",
        tooltip: `${article.publisher ?? "Unknown publisher"} · ${article.url}`,
        rank: KB_GRAPH_RANK_ARTICLE,
        order: entityIndex * 1000 + articleIndex,
        emphasis: false,
        linkResource: "data-sources",
        linkId: article.dataSourceId,
        publisher: article.publisher,
        publishedAt: article.publishedAt,
        url: article.url,
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
        ...NO_NODE_DETAILS,
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

  edges.push(...relationEdges);

  if (undrawn > 0) {
    nodes.push({
      ...NO_NODE_DETAILS,
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

  const seenNodeIds = new Set<string>();
  const uniqueNodes = nodes.filter((node) => {
    if (seenNodeIds.has(node.id)) {
      return false;
    }
    seenNodeIds.add(node.id);

    return true;
  });

  return {
    nodes: uniqueNodes,
    edges,
    truncated: notes.length > 0,
    truncatedLabel: notes.join(" "),
  };
}
