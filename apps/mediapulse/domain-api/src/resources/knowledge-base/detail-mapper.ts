import type { Prisma } from "@mediapulse/database";

import {
  buildKnowledgeBaseGraph,
  type KnowledgeGraphPayload,
} from "./build-knowledge-base-graph";
import { kindLabel, sourceLabel, truncateTitle } from "./knowledge-base-labels";

/** Entities read for one detail page. Above this a ticker's graph is unreadable anyway. */
export const KB_ENTITY_FETCH_CAP = 200;

/** Articles read per entity, which is what the tabs and the graph both draw from. */
export const KB_ARTICLES_PER_ENTITY_FETCH_CAP = 10;

export const detailInclude = {
  knowledgeTickerEntities: {
    orderBy: [{ mentionCount: "desc" }],
    take: KB_ENTITY_FETCH_CAP,
    include: {
      entity: {
        select: {
          id: true,
          kind: true,
          canonicalName: true,
          source: true,
          aliases: { select: { alias: true }, take: 8 },
        },
      },
    },
  },
  knowledgeTickerRelations: {
    include: {
      relation: {
        select: {
          id: true,
          subjectEntityId: true,
          objectEntityId: true,
          kindSlug: true,
          label: true,
          source: true,
          observations: true,
          evidenceSpan: true,
          evidenceDataSourceId: true,
          lastObservedAt: true,
          kind: { select: { label: true, inverseLabel: true, curated: true } },
          subjectEntity: { select: { canonicalName: true } },
          objectEntity: { select: { canonicalName: true } },
        },
      },
    },
  },
} satisfies Prisma.TickerInclude;

export type KnowledgeBaseDetailRow = Prisma.TickerGetPayload<{
  include: typeof detailInclude;
}>;

/** One article naming one of the ticker's entities. */
export type MentionRow = {
  entityId: string;
  dataSourceId: string;
  surfaceForm: string | null;
  evidenceSpan: string | null;
  dataSource: {
    id: string;
    title: string;
    url: string;
    registrableDomain: string | null;
    publishedAt: Date | null;
  };
};

export type KnowledgeEntityRow = {
  entityId: string;
  canonicalName: string;
  kindLabel: string;
  sourceLabel: string;
  mentionCount: number;
  aliases: string;
  lastSeenAt: string;
};

export type KnowledgeRelationRow = {
  relationId: string;
  subject: string;
  predicate: string;
  object: string;
  kindSlug: string;
  emittedLabel: string;
  sourceLabel: string;
  curatedLabel: string;
  observations: number;
  evidenceSpan: string;
  dataSourceId: string | null;
  lastObservedAt: string;
};

export type KnowledgeArticleRow = {
  dataSourceId: string;
  title: string;
  url: string;
  publisher: string;
  entityNames: string;
  publishedAt: string | null;
};

export type DetailItem = {
  id: string;
  title: string;
  symbol: string;
  name: string;
  entityCount: number;
  relationCount: number;
  articleCount: number;
  profileRelationCount: number;
  extractedRelationCount: number;
  header: {
    entitiesLabel: string;
    relationsLabel: string;
    articlesLabel: string;
    groundingLabel: string;
    groundingVariant: "success" | "warning";
    lastSeenLabel: string;
  };
  entities: KnowledgeEntityRow[];
  relations: KnowledgeRelationRow[];
  articles: KnowledgeArticleRow[];
  graph: KnowledgeGraphPayload;
};

const isoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

/**
 * Shapes one ticker's knowledge base for the detail page and its graph.
 *
 * @param row - The ticker with its entity and relation memberships.
 * @param mentions - Every mention read for this ticker, newest first.
 */
export function mapRowToDetailItem(
  row: KnowledgeBaseDetailRow,
  mentions: readonly MentionRow[],
): DetailItem {
  const mentionsByEntity = new Map<string, MentionRow[]>();
  for (const mention of mentions) {
    const bucket = mentionsByEntity.get(mention.entityId) ?? [];
    if (bucket.length < KB_ARTICLES_PER_ENTITY_FETCH_CAP) {
      bucket.push(mention);
    }
    mentionsByEntity.set(mention.entityId, bucket);
  }

  const entities: KnowledgeEntityRow[] = row.knowledgeTickerEntities.map(
    (link) => ({
      entityId: link.entity.id,
      canonicalName: link.entity.canonicalName,
      kindLabel: kindLabel(link.entity.kind),
      sourceLabel: sourceLabel(link.source),
      mentionCount: link.mentionCount,
      aliases: link.entity.aliases
        .map((alias) => alias.alias)
        .filter((alias) => alias !== link.entity.canonicalName)
        .join(", "),
      lastSeenAt: link.lastSeenAt.toISOString(),
    }),
  );

  const relations: KnowledgeRelationRow[] = row.knowledgeTickerRelations.map(
    (link) => ({
      relationId: link.relation.id,
      subject: link.relation.subjectEntity.canonicalName,
      predicate: link.relation.kind.label,
      object: link.relation.objectEntity.canonicalName,
      kindSlug: link.relation.kindSlug,
      emittedLabel: link.relation.label ?? "—",
      sourceLabel: sourceLabel(link.relation.source),
      curatedLabel: link.relation.kind.curated ? "curated" : "new kind",
      observations: link.relation.observations,
      // An empty span is the point, not an omission: a relation no article states has none.
      evidenceSpan:
        link.relation.evidenceSpan === null
          ? "—"
          : truncateTitle(link.relation.evidenceSpan, 220),
      dataSourceId: link.relation.evidenceDataSourceId,
      lastObservedAt: link.relation.lastObservedAt.toISOString(),
    }),
  );

  const namesByArticle = new Map<string, Set<string>>();
  const nameByEntity = new Map(
    row.knowledgeTickerEntities.map((link) => [
      link.entity.id,
      link.entity.canonicalName,
    ]),
  );
  for (const mention of mentions) {
    const names = namesByArticle.get(mention.dataSourceId) ?? new Set<string>();
    const name = nameByEntity.get(mention.entityId);
    if (name !== undefined) {
      names.add(name);
    }
    namesByArticle.set(mention.dataSourceId, names);
  }

  const articles: KnowledgeArticleRow[] = [];
  const seenArticles = new Set<string>();
  for (const mention of mentions) {
    if (seenArticles.has(mention.dataSourceId)) {
      continue;
    }
    seenArticles.add(mention.dataSourceId);
    articles.push({
      dataSourceId: mention.dataSourceId,
      title: mention.dataSource.title,
      url: mention.dataSource.url,
      publisher: mention.dataSource.registrableDomain ?? "—",
      entityNames: [
        ...(namesByArticle.get(mention.dataSourceId) ?? new Set<string>()),
      ].join(", "),
      publishedAt: isoOrNull(mention.dataSource.publishedAt),
    });
  }

  const profileRelationCount = relations.filter(
    (relation) => relation.evidenceSpan === "—",
  ).length;
  const extractedRelationCount = relations.length - profileRelationCount;

  const graph = buildKnowledgeBaseGraph({
    ticker: { tickerId: row.id, symbol: row.symbol, name: row.name },
    entities: row.knowledgeTickerEntities.map((link) => {
      const entityMentions = mentionsByEntity.get(link.entity.id) ?? [];

      return {
        entityId: link.entity.id,
        canonicalName: link.entity.canonicalName,
        kind: link.entity.kind,
        isIssuer: link.isIssuer,
        mentionCount: link.mentionCount,
        sourceLabel: sourceLabel(link.source),
        surfaceForm: entityMentions[0]?.surfaceForm ?? null,
        articles: entityMentions.map((mention) => ({
          dataSourceId: mention.dataSourceId,
          title: mention.dataSource.title,
          url: mention.dataSource.url,
          publisher: mention.dataSource.registrableDomain,
        })),
      };
    }),
    relations: row.knowledgeTickerRelations.map((link) => ({
      subjectEntityId: link.relation.subjectEntityId,
      objectEntityId: link.relation.objectEntityId,
      label: link.relation.kind.label,
      inverseLabel: link.relation.kind.inverseLabel,
    })),
    totals: {
      entityCount: entities.length,
      relationCount: relations.length,
      articleCount: articles.length,
    },
  });

  const seenAt = entities.map((entity) => entity.lastSeenAt).sort();
  const lastSeen = seenAt[seenAt.length - 1];

  return {
    id: row.id,
    title: `${row.symbol} — ${row.name}`,
    symbol: row.symbol,
    name: row.name,
    entityCount: entities.length,
    relationCount: relations.length,
    articleCount: articles.length,
    profileRelationCount,
    extractedRelationCount,
    header: {
      entitiesLabel: String(entities.length),
      relationsLabel: String(relations.length),
      articlesLabel: String(articles.length),
      groundingLabel: `${String(extractedRelationCount)} article-grounded, ${String(profileRelationCount)} from the profile`,
      groundingVariant: extractedRelationCount > 0 ? "success" : "warning",
      lastSeenLabel: lastSeen ?? "never",
    },
    entities,
    relations,
    articles,
    graph,
  };
}
