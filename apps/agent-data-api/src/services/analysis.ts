import { prisma } from "@workspace/database";

import type {
  GetAnalysisResponse,
  PostAnalysisBody,
  PostAnalysisResponse,
} from "../schemas/analysis.js";

type AnalysisDb = {
  dataSource: {
    findMany: (args: Record<string, unknown>) => Promise<
      Array<{
        id: string;
        url: string;
        title: string;
        content: string;
        tickerId: string;
        createdAt: Date;
      }>
    >;
  };
  entityType: {
    findMany: (args?: Record<string, unknown>) => Promise<
      Array<{
        id: string;
        name: string;
        description: string | null;
      }>
    >;
  };
  relationType: {
    findMany: (args?: Record<string, unknown>) => Promise<
      Array<{
        id: string;
        name: string;
        description: string | null;
      }>
    >;
  };
  tickerEntity: {
    findMany: (args: Record<string, unknown>) => Promise<
      Array<{
        entity: {
          id: string;
          canonicalName: string;
          typeId: string;
          aliases: Array<{ alias: string }>;
        };
      }>
    >;
    upsert: (args: Record<string, unknown>) => Promise<unknown>;
  };
  entityAlias: {
    findMany: (args: Record<string, unknown>) => Promise<
      Array<{
        entityId: string;
      }>
    >;
    findFirst: (args: Record<string, unknown>) => Promise<{
      entityId: string;
    } | null>;
    createMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  entity: {
    create: (args: Record<string, unknown>) => Promise<{ id: string }>;
  };
  entityRelation: {
    findUnique: (
      args: Record<string, unknown>,
    ) => Promise<{ id: string } | null>;
    upsert: (args: Record<string, unknown>) => Promise<unknown>;
  };
  articleEntity: {
    upsert: (args: Record<string, unknown>) => Promise<unknown>;
  };
  articleRelevance: {
    createMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: AnalysisDb) => Promise<T>) => Promise<T>;
};

/**
 * Normalizes an alias for deduplication by lowercasing, trimming, stripping punctuation,
 * and collapsing whitespace.
 *
 * @param alias - The raw alias value.
 * @returns A normalized alias string.
 */
export const normalizeAlias = (alias: string): string =>
  alias
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ");

/**
 * Fetches analysis context for a ticker: target data sources, vocabularies,
 * and existing entities/aliases in the ticker graph.
 *
 * @param tickerId - The ticker UUID.
 * @param unanalyzed - Whether to return only data sources without relevance rows for the ticker.
 * @param db - The database client dependency, defaults to prisma.
 * @returns Data sources, entity/relation vocabularies, and existing entities.
 */
export const getAnalysisData = async (
  tickerId: string,
  unanalyzed: boolean,
  db: AnalysisDb = prisma as unknown as AnalysisDb,
): Promise<GetAnalysisResponse> => {
  const dataSourceWhere: Record<string, unknown> = { tickerId };
  if (unanalyzed) {
    dataSourceWhere.articleRelevances = { none: { tickerId } };
  }

  const [dataSources, entityTypes, relationTypes, tickerEntities] =
    await Promise.all([
      db.dataSource.findMany({
        where: dataSourceWhere,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          title: true,
          content: true,
          tickerId: true,
          createdAt: true,
        },
      }),
      db.entityType.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true },
      }),
      db.relationType.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true },
      }),
      db.tickerEntity.findMany({
        where: { tickerId },
        include: {
          entity: {
            select: {
              id: true,
              canonicalName: true,
              typeId: true,
              aliases: { select: { alias: true } },
            },
          },
        },
      }),
    ]);

  return {
    dataSources,
    entityTypes,
    relationTypes,
    existingEntities: tickerEntities.map((row) => ({
      id: row.entity.id,
      canonicalName: row.entity.canonicalName,
      typeId: row.entity.typeId,
      aliases: row.entity.aliases.map((alias) => alias.alias),
    })),
  };
};

/**
 * Persists analysis output in a single transaction: entities/aliases, ticker links,
 * relations, article entity mentions, and article relevance scores.
 *
 * @param data - Analysis payload from the analysis agent.
 * @param db - The database client dependency, defaults to prisma.
 * @returns Counters for created/reused graph items and scored/selected articles.
 */
export const saveAnalysisData = async (
  data: PostAnalysisBody,
  db: AnalysisDb = prisma as unknown as AnalysisDb,
): Promise<PostAnalysisResponse> =>
  db.$transaction(async (tx) => {
    let entitiesCreated = 0;
    let entitiesReused = 0;
    let relationsCreated = 0;

    const aliasToEntityId = new Map<string, string>();

    const resolveEntityId = async (name: string): Promise<string> => {
      const normalized = normalizeAlias(name);
      const cached = aliasToEntityId.get(normalized);
      if (cached) {
        return cached;
      }

      const existingAlias = await tx.entityAlias.findFirst({
        where: { normalizedAlias: normalized },
        select: { entityId: true },
      });

      if (!existingAlias) {
        throw new Error(`Entity alias not found for "${name}"`);
      }

      aliasToEntityId.set(normalized, existingAlias.entityId);
      return existingAlias.entityId;
    };

    for (const entityInput of data.entities) {
      const allAliases = Array.from(
        new Set([entityInput.canonicalName, ...entityInput.aliases]),
      );
      const normalizedAliases = Array.from(
        new Set(
          allAliases
            .map((alias) => ({ alias, normalizedAlias: normalizeAlias(alias) }))
            .filter((alias) => alias.normalizedAlias.length > 0)
            .map((alias) => alias.normalizedAlias),
        ),
      );

      const existingAliases =
        normalizedAliases.length > 0
          ? await tx.entityAlias.findMany({
              where: { normalizedAlias: { in: normalizedAliases } },
              select: { entityId: true },
              take: 1,
            })
          : [];

      const matchedAlias = existingAliases.at(0);
      let entityId: string;
      if (matchedAlias) {
        entityId = matchedAlias.entityId;
        entitiesReused += 1;
      } else {
        const createdEntity = await tx.entity.create({
          data: {
            canonicalName: entityInput.canonicalName,
            typeId: entityInput.typeId,
            description: entityInput.description ?? null,
          },
          select: { id: true },
        });
        entityId = createdEntity.id;
        entitiesCreated += 1;
      }

      const aliasRowsByNormalized = new Map<
        string,
        { alias: string; normalizedAlias: string }
      >();
      for (const alias of allAliases) {
        const normalizedAlias = normalizeAlias(alias);
        if (!normalizedAlias) {
          continue;
        }
        if (!aliasRowsByNormalized.has(normalizedAlias)) {
          aliasRowsByNormalized.set(normalizedAlias, {
            alias,
            normalizedAlias,
          });
        }
      }
      const aliasRows = Array.from(aliasRowsByNormalized.values());

      if (aliasRows.length > 0) {
        await tx.entityAlias.createMany({
          data: aliasRows.map((alias) => ({
            entityId,
            alias: alias.alias,
            normalizedAlias: alias.normalizedAlias,
          })),
          skipDuplicates: true,
        });
      }

      await tx.tickerEntity.upsert({
        where: {
          tickerId_entityId: {
            tickerId: data.tickerId,
            entityId,
          },
        },
        update: {},
        create: {
          tickerId: data.tickerId,
          entityId,
          source: "EXTRACTED",
        },
      });

      for (const alias of allAliases) {
        aliasToEntityId.set(normalizeAlias(alias), entityId);
      }
    }

    for (const relation of data.relations) {
      const fromEntityId = await resolveEntityId(relation.fromEntityName);
      const toEntityId = await resolveEntityId(relation.toEntityName);

      const existingRelation = await tx.entityRelation.findUnique({
        where: {
          fromEntityId_toEntityId_relationTypeId: {
            fromEntityId,
            toEntityId,
            relationTypeId: relation.relationTypeId,
          },
        },
        select: { id: true },
      });

      await tx.entityRelation.upsert({
        where: {
          fromEntityId_toEntityId_relationTypeId: {
            fromEntityId,
            toEntityId,
            relationTypeId: relation.relationTypeId,
          },
        },
        update: { lastSeenAt: new Date() },
        create: {
          fromEntityId,
          toEntityId,
          relationTypeId: relation.relationTypeId,
        },
      });

      if (!existingRelation) {
        relationsCreated += 1;
      }
    }

    for (const articleEntity of data.articleEntities) {
      const entityId = await resolveEntityId(articleEntity.entityName);

      await tx.articleEntity.upsert({
        where: {
          dataSourceId_entityId: {
            dataSourceId: articleEntity.dataSourceId,
            entityId,
          },
        },
        update: {
          mentionCount: articleEntity.mentionCount,
          confidence: articleEntity.confidence,
          sentiment: articleEntity.sentiment ?? null,
        },
        create: {
          dataSourceId: articleEntity.dataSourceId,
          entityId,
          mentionCount: articleEntity.mentionCount,
          confidence: articleEntity.confidence,
          sentiment: articleEntity.sentiment ?? null,
        },
      });
    }

    await tx.articleRelevance.createMany({
      data: data.articleRelevances.map((articleRelevance) => ({
        dataSourceId: articleRelevance.dataSourceId,
        tickerId: data.tickerId,
        score: articleRelevance.score,
        scoreBreakdown: articleRelevance.scoreBreakdown,
        selected: articleRelevance.selected,
      })),
      skipDuplicates: true,
    });

    return {
      entitiesCreated,
      entitiesReused,
      relationsCreated,
      articlesScored: data.articleRelevances.length,
      articlesSelected: data.articleRelevances.filter((row) => row.selected)
        .length,
    };
  });
