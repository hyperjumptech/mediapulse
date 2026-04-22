import type {
  GetAnalysisQuery,
  GetAnalysisResponse,
  PostAnalysisBody,
  PostAnalysisResponse,
} from "@workspace/agent-data-api-contract";
import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";

/**
 * Thrown when the analysis POST body references data sources that do not belong to the ticker.
 */
export class AnalysisPostValidationError extends Error {
  /**
   * @param message - Human-readable validation message.
   */
  constructor(message: string) {
    super(message);
    this.name = "AnalysisPostValidationError";
  }
}

type AnalysisDb = {
  dataSource: Pick<
    typeof prisma.dataSource,
    "findMany" | "findUnique" | "findFirst" | "count"
  >;
  entityType: Pick<typeof prisma.entityType, "findMany">;
  relationType: Pick<typeof prisma.relationType, "findMany">;
  entity: Pick<typeof prisma.entity, "findFirst" | "findMany" | "create">;
  entityAlias: Pick<typeof prisma.entityAlias, "createMany">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "create" | "findFirst">;
  entityRelation: Pick<typeof prisma.entityRelation, "create" | "findUnique">;
  articleEntity: Pick<typeof prisma.articleEntity, "upsert">;
  articleRelevance: Pick<
    typeof prisma.articleRelevance,
    "upsert" | "count" | "findFirst"
  >;
  $transaction: typeof prisma.$transaction;
};

const defaultDb: AnalysisDb = prisma;

/**
 * Normalizes a name or alias for case-insensitive matching.
 *
 * @param value - Raw string from the agent payload.
 * @returns Trimmed lowercase string.
 */
export const normalizeAnalysisName = (value: string): string =>
  value.trim().toLowerCase();

/**
 * Loads ticker-scoped analysis context: eligible data sources, vocabulary, and existing KG entities.
 *
 * @param query - Parsed GET query (`unanalyzed` defaults to incremental backlog only; optional `start` / `end` bound `DataSource.createdAt` inclusively when set).
 * @param deps - Injectable database delegates for tests.
 * @returns Payload matching `getAnalysisResponseSchema`.
 */
export const loadAnalysisContext = async (
  query: GetAnalysisQuery,
  deps: { db?: AnalysisDb } = {},
): Promise<GetAnalysisResponse> => {
  const db = deps.db ?? defaultDb;

  const createdAtWhere =
    query.start !== undefined || query.end !== undefined
      ? ({
          ...(query.start !== undefined ? { gte: new Date(query.start) } : {}),
          ...(query.end !== undefined ? { lte: new Date(query.end) } : {}),
        } satisfies Prisma.DateTimeFilter)
      : undefined;

  const dataSourceWhere = {
    tickerId: query.tickerId,
    ...(createdAtWhere ? { createdAt: createdAtWhere } : {}),
    ...(query.unanalyzed
      ? {
          NOT: {
            articleRelevances: {
              some: { tickerId: query.tickerId },
            },
          },
        }
      : {}),
  } satisfies Prisma.DataSourceWhereInput;

  const dataSourceSelect = {
    id: true,
    url: true,
    title: true,
    content: true,
    tickerId: true,
    createdAt: true,
  } satisfies Prisma.DataSourceSelect;

  const dataSourceFindArgsBase = {
    where: dataSourceWhere,
    orderBy: { createdAt: "asc" as const },
    select: dataSourceSelect,
  } satisfies Prisma.DataSourceFindManyArgs;

  const entityTypeArgs = {
    orderBy: { name: "asc" as const },
  } satisfies Prisma.EntityTypeFindManyArgs;

  const relationTypeArgs = {
    orderBy: { name: "asc" as const },
  } satisfies Prisma.RelationTypeFindManyArgs;

  const existingEntityArgs = {
    where: {
      tickerEntities: { some: { tickerId: query.tickerId } },
    },
    include: { aliases: true },
    orderBy: { canonicalName: "asc" as const },
  } satisfies Prisma.EntityFindManyArgs;

  const utcDayStart = new Date();
  utcDayStart.setUTCHours(0, 0, 0, 0);

  const relevanceCountArgs = {
    where: {
      tickerId: query.tickerId,
      selected: true,
      scoredAt: { gte: utcDayStart },
    },
  } satisfies Prisma.ArticleRelevanceCountArgs;

  const lastRelevanceArgs = {
    where: { tickerId: query.tickerId },
    orderBy: { scoredAt: "desc" as const },
    select: { scoredAt: true },
  } satisfies Prisma.ArticleRelevanceFindFirstArgs;

  const limit = query.limit;

  let dataSources: GetAnalysisResponse["dataSources"];
  let dataSourceTotalCount: number;
  if (limit !== undefined) {
    const [rows, total] = await Promise.all([
      db.dataSource.findMany({ ...dataSourceFindArgsBase, take: limit }),
      db.dataSource.count({ where: dataSourceWhere }),
    ]);
    dataSources = rows;
    dataSourceTotalCount = total;
  } else {
    dataSources = await db.dataSource.findMany(dataSourceFindArgsBase);
    dataSourceTotalCount = dataSources.length;
  }

  const [
    entityTypes,
    relationTypes,
    existingEntityRows,
    selectedCountToday,
    lastRelevanceRow,
  ] = await Promise.all([
    db.entityType.findMany(entityTypeArgs),
    db.relationType.findMany(relationTypeArgs),
    db.entity.findMany(existingEntityArgs),
    db.articleRelevance.count(relevanceCountArgs),
    db.articleRelevance.findFirst(lastRelevanceArgs),
  ]);

  return {
    dataSources,
    dataSourceTotalCount,
    entityTypes,
    relationTypes,
    existingEntities: existingEntityRows.map((row) => ({
      id: row.id,
      canonicalName: row.canonicalName,
      typeId: row.typeId,
      aliases: row.aliases.map((a) => a.alias),
    })),
    relevanceSelectionState: {
      utcDayStartIso: utcDayStart.toISOString(),
      selectedCountToday,
    },
    lastRelevanceScoredAtIso: lastRelevanceRow
      ? lastRelevanceRow.scoredAt.toISOString()
      : null,
  };
};

/**
 * Persists analysis POST payloads: entities, relations, per-article mentions, and relevance rows.
 *
 * @param body - Validated POST body.
 * @param deps - Injectable database delegates for tests.
 * @returns Aggregate counts for the agent run.
 */
export const applyAnalysisPost = async (
  body: PostAnalysisBody,
  deps: { db?: AnalysisDb } = {},
): Promise<PostAnalysisResponse> => {
  const db = deps.db ?? defaultDb;

  const dataSourceIds = new Set<string>();
  for (const row of body.articleEntities) {
    dataSourceIds.add(row.dataSourceId);
  }
  for (const row of body.articleRelevances) {
    dataSourceIds.add(row.dataSourceId);
  }

  return db.$transaction(async (tx) => {
    for (const dataSourceId of dataSourceIds) {
      const ds = await tx.dataSource.findUnique({
        where: { id: dataSourceId },
        select: { tickerId: true },
      });
      if (!ds || ds.tickerId !== body.tickerId) {
        throw new AnalysisPostValidationError(
          `dataSourceId ${dataSourceId} is missing or not scoped to tickerId`,
        );
      }
    }

    const nameToEntityId = new Map<string, string>();
    let entitiesCreated = 0;
    let entitiesReused = 0;

    for (const ent of body.entities) {
      const existing = await findReusableEntity(
        tx,
        ent.typeId,
        ent.canonicalName,
        [ent.canonicalName, ...ent.aliases],
      );

      let entityId: string;
      if (existing) {
        entityId = existing.id;
        entitiesReused += 1;
        const linked = await tx.tickerEntity.findFirst({
          where: { tickerId: body.tickerId, entityId },
          select: { id: true },
        });
        if (!linked) {
          await tx.tickerEntity.create({
            data: {
              tickerId: body.tickerId,
              entityId,
              source: "EXTRACTED",
            },
          });
        }
      } else {
        const created = await tx.entity.create({
          data: {
            typeId: ent.typeId,
            canonicalName: ent.canonicalName.trim(),
            description: ent.description?.trim() ?? null,
          },
        });
        entityId = created.id;
        entitiesCreated += 1;

        const aliasRows: Prisma.EntityAliasCreateManyInput[] = [];
        const seenNorm = new Set<string>();
        const addAlias = (raw: string) => {
          const trimmed = raw.trim();
          const n = normalizeAnalysisName(trimmed);
          if (seenNorm.has(n)) return;
          seenNorm.add(n);
          aliasRows.push({
            entityId,
            alias: trimmed,
            normalizedAlias: n,
          });
        };
        addAlias(ent.canonicalName);
        for (const a of ent.aliases) {
          addAlias(a);
        }
        if (aliasRows.length > 0) {
          await tx.entityAlias.createMany({
            data: aliasRows,
            skipDuplicates: true,
          });
        }

        await tx.tickerEntity.create({
          data: {
            tickerId: body.tickerId,
            entityId,
            source: "EXTRACTED",
          },
        });
      }

      const registerName = (raw: string) => {
        nameToEntityId.set(normalizeAnalysisName(raw), entityId);
      };
      registerName(ent.canonicalName);
      for (const a of ent.aliases) {
        registerName(a);
      }
    }

    let relationsCreated = 0;
    for (const rel of body.relations) {
      const fromId = nameToEntityId.get(
        normalizeAnalysisName(rel.fromEntityName),
      );
      const toId = nameToEntityId.get(normalizeAnalysisName(rel.toEntityName));
      if (!fromId || !toId) {
        throw new AnalysisPostValidationError(
          `Unknown entity name in relation: ${rel.fromEntityName} -> ${rel.toEntityName}`,
        );
      }

      const existingRel = await tx.entityRelation.findUnique({
        where: {
          fromEntityId_toEntityId_relationTypeId: {
            fromEntityId: fromId,
            toEntityId: toId,
            relationTypeId: rel.relationTypeId,
          },
        },
        select: { id: true },
      });
      if (!existingRel) {
        await tx.entityRelation.create({
          data: {
            fromEntityId: fromId,
            toEntityId: toId,
            relationTypeId: rel.relationTypeId,
          },
        });
        relationsCreated += 1;
      }
    }

    for (const mention of body.articleEntities) {
      let entityId: string | undefined = nameToEntityId.get(
        normalizeAnalysisName(mention.entityName),
      );
      if (entityId === undefined) {
        entityId =
          (await resolveEntityIdByNameForTicker(
            tx,
            body.tickerId,
            mention.entityName,
          )) ?? undefined;
      }
      if (entityId === undefined) {
        throw new AnalysisPostValidationError(
          `Unknown entityName for article entity: ${mention.entityName}`,
        );
      }

      await tx.articleEntity.upsert({
        where: {
          dataSourceId_entityId: {
            dataSourceId: mention.dataSourceId,
            entityId,
          },
        },
        create: {
          dataSourceId: mention.dataSourceId,
          entityId,
          mentionCount: mention.mentionCount,
          confidence: mention.confidence,
          sentiment: mention.sentiment ?? null,
        },
        update: {
          mentionCount: mention.mentionCount,
          confidence: mention.confidence,
          sentiment: mention.sentiment ?? null,
        },
      });
    }

    let articlesScored = 0;
    for (const relRow of body.articleRelevances) {
      const scoreBreakdown = relRow.scoreBreakdown as Prisma.InputJsonValue;
      await tx.articleRelevance.upsert({
        where: {
          dataSourceId_tickerId: {
            dataSourceId: relRow.dataSourceId,
            tickerId: body.tickerId,
          },
        },
        create: {
          dataSourceId: relRow.dataSourceId,
          tickerId: body.tickerId,
          score: relRow.score,
          scoreBreakdown,
          selected: relRow.selected,
          scoredAt: new Date(),
        },
        update: {
          score: relRow.score,
          scoreBreakdown,
          selected: relRow.selected,
          scoredAt: new Date(),
        },
      });
      articlesScored += 1;
    }

    const articlesSelected = body.articleRelevances.filter(
      (r) => r.selected,
    ).length;

    return {
      entitiesCreated,
      entitiesReused,
      relationsCreated,
      articlesScored,
      articlesSelected,
    };
  });
};

/**
 * Finds an entity that matches canonical name or alias (case-insensitive) for a given type.
 *
 * @param tx - Prisma transaction client.
 * @param typeId - Entity type UUID.
 * @param canonicalName - Primary name from the payload.
 * @param nameVariants - Canonical plus alias strings to match.
 * @returns Existing entity id or null.
 */
async function findReusableEntity(
  tx: Prisma.TransactionClient,
  typeId: string,
  canonicalName: string,
  nameVariants: string[],
): Promise<{ id: string } | null> {
  const normalizedSet = new Set(
    nameVariants.map((n) => normalizeAnalysisName(n)),
  );
  const normalizedList = [...normalizedSet];

  return tx.entity.findFirst({
    where: {
      typeId,
      OR: [
        {
          canonicalName: {
            equals: canonicalName.trim(),
            mode: "insensitive",
          },
        },
        {
          aliases: {
            some: {
              normalizedAlias: { in: normalizedList },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
}

/**
 * Resolves an entity id by display name for a ticker when not present in the run-local map.
 *
 * @param tx - Prisma transaction client.
 * @param tickerId - Ticker scope.
 * @param entityName - Mention name from the payload.
 * @returns Entity id or null.
 */
async function resolveEntityIdByNameForTicker(
  tx: Prisma.TransactionClient,
  tickerId: string,
  entityName: string,
): Promise<string | null> {
  const n = normalizeAnalysisName(entityName);
  const entity = await tx.entity.findFirst({
    where: {
      tickerEntities: { some: { tickerId } },
      OR: [
        {
          canonicalName: {
            equals: entityName.trim(),
            mode: "insensitive",
          },
        },
        {
          aliases: {
            some: { normalizedAlias: n },
          },
        },
      ],
    },
    select: { id: true },
  });
  return entity?.id ?? null;
}
