import type {
  GetAnalysisQuery,
  GetAnalysisResponse,
  PostAnalysisDataSourceDeleteBody,
  PostAnalysisBody,
  PostAnalysisResponse,
} from "@workspace/agent-data-api-contract";
import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";

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
    "findMany" | "findUnique" | "findFirst" | "count" | "deleteMany"
  >;
  ticker: Pick<typeof prisma.ticker, "findUnique">;
  entityType: Pick<typeof prisma.entityType, "findMany" | "findFirst">;
  relationType: Pick<typeof prisma.relationType, "findMany">;
  entity: Pick<typeof prisma.entity, "findFirst" | "findMany" | "create">;
  entityAlias: Pick<typeof prisma.entityAlias, "createMany">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "create" | "findFirst">;
  entityRelation: Pick<typeof prisma.entityRelation, "create" | "findUnique">;
  entityEvidence: Pick<typeof prisma.entityEvidence, "upsert">;
  entityRelationEvidence: Pick<typeof prisma.entityRelationEvidence, "upsert">;
  articleEntity: Pick<typeof prisma.articleEntity, "upsert">;
  articleRelevance: Pick<
    typeof prisma.articleRelevance,
    "upsert" | "count" | "findFirst"
  >;
  $transaction: typeof prisma.$transaction;
};

/** Database delegates used by analysis POST persistence (no interactive transaction). */
type AnalysisWriteDb = Omit<AnalysisDb, "$transaction" | "relationType">;

const defaultDb: AnalysisDb = prisma;

type TickerIssuerAnchor = {
  entityId: string;
  canonicalName: string;
  aliases: string[];
};

/**
 * Ensures the issuer/company node exists for a ticker's KG and is linked via `ticker_entity`.
 *
 * This is an anchor node used to make ticker graphs interpretable (issuer-centric edges).
 * It is created or reused based on alias matching rules and is linked with `source: SEED`.
 *
 * @param db - Injectable database delegates for write path.
 * @param tickerId - Ticker scope.
 * @returns Anchor metadata (id + names) or null when the ticker/type cannot be resolved.
 */
async function ensureTickerIssuerCompanyAnchor(
  db: Pick<
    AnalysisDb,
    "ticker" | "entityType" | "entity" | "entityAlias" | "tickerEntity"
  >,
  tickerId: string,
): Promise<TickerIssuerAnchor | null> {
  const ticker = await db.ticker.findUnique({
    where: { id: tickerId },
    select: { symbol: true, name: true, metadata: true },
  } satisfies Prisma.TickerFindUniqueArgs);
  if (!ticker) return null;

  const companyType = await db.entityType.findFirst({
    where: { name: "COMPANY" },
    select: { id: true },
  } satisfies Prisma.EntityTypeFindFirstArgs);
  if (!companyType) return null;

  const aliases = [ticker.symbol, ticker.name]
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  const canonicalName = ticker.name.trim();
  const existing = await findReusableEntity(
    { entity: db.entity },
    companyType.id,
    canonicalName,
    aliases,
  );

  const entityId =
    existing?.id ??
    (
      await db.entity.create({
        data: {
          typeId: companyType.id,
          canonicalName,
          description: null,
          ...(ticker.metadata !== undefined && ticker.metadata !== null
            ? { metadata: ticker.metadata as Prisma.InputJsonValue }
            : {}),
        },
        select: { id: true },
      } satisfies Prisma.EntityCreateArgs)
    ).id;

  if (!existing) {
    const aliasRows: Prisma.EntityAliasCreateManyInput[] = [];
    const seenNorm = new Set<string>();
    for (const raw of aliases) {
      const n = normalizeAnalysisName(raw);
      if (seenNorm.has(n)) continue;
      seenNorm.add(n);
      aliasRows.push({
        entityId,
        alias: raw.trim(),
        normalizedAlias: n,
      });
    }
    if (aliasRows.length > 0) {
      await db.entityAlias.createMany({
        data: aliasRows,
        skipDuplicates: true,
      } satisfies Prisma.EntityAliasCreateManyArgs);
    }
  }

  const linked = await db.tickerEntity.findFirst({
    where: { tickerId, entityId },
    select: { id: true },
  } satisfies Prisma.TickerEntityFindFirstArgs);
  if (!linked) {
    await db.tickerEntity.create({
      data: { tickerId, entityId, source: "SEED" },
      select: { id: true },
    } satisfies Prisma.TickerEntityCreateArgs);
  }

  return {
    entityId,
    canonicalName,
    aliases: [...new Set(aliases)],
  };
}

/**
 * Loads data sources for analysis GET: optional `limit` page plus total row count for the same filters.
 * Shape matches `getAnalysisResponseSchema` fields `dataSources` and `dataSourceTotalCount`.
 */
async function loadAnalysisDataSourcesPage(
  db: AnalysisDb,
  findArgsBase: Prisma.DataSourceFindManyArgs,
  where: Prisma.DataSourceWhereInput,
  limit: number | undefined,
): Promise<{
  dataSources: GetAnalysisResponse["dataSources"];
  dataSourceTotalCount: number;
}> {
  if (limit !== undefined) {
    const [rows, total] = await Promise.all([
      db.dataSource.findMany({ ...findArgsBase, take: limit }),
      db.dataSource.count({ where }),
    ]);
    return { dataSources: rows, dataSourceTotalCount: total };
  }
  const dataSources = await db.dataSource.findMany(findArgsBase);
  return { dataSources, dataSourceTotalCount: dataSources.length };
}

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

  const ticker = await db.ticker.findUnique({
    where: { id: query.tickerId },
    select: { id: true, symbol: true, name: true },
  } satisfies Prisma.TickerFindUniqueArgs);
  if (!ticker) {
    throw new Error(`Unknown tickerId ${query.tickerId}`);
  }

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

  const { dataSources, dataSourceTotalCount } =
    await loadAnalysisDataSourcesPage(
      db,
      dataSourceFindArgsBase,
      dataSourceWhere,
      limit,
    );

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
    ticker,
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
 * Writes run without a Prisma interactive transaction so large batches are not capped by the 5s default timeout.
 *
 * @param body - Validated POST body.
 * @param deps - Injectable database delegates for tests.
 * @returns Aggregate counts for the agent run.
 */
export const applyAnalysisPost = async (
  body: PostAnalysisBody,
  deps: { db?: AnalysisWriteDb } = {},
): Promise<PostAnalysisResponse> => {
  const db = deps.db ?? defaultDb;
  const entityEvidence = body.entityEvidence ?? [];
  const relationEvidence = body.relationEvidence ?? [];

  const dataSourceIds = new Set<string>();
  for (const row of body.articleEntities) {
    dataSourceIds.add(row.dataSourceId);
  }
  for (const row of body.articleRelevances) {
    dataSourceIds.add(row.dataSourceId);
  }
  for (const row of entityEvidence) {
    dataSourceIds.add(row.dataSourceId);
  }
  for (const row of relationEvidence) {
    dataSourceIds.add(row.dataSourceId);
  }

  for (const dataSourceId of dataSourceIds) {
    const ds = await db.dataSource.findUnique({
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
      db,
      ent.typeId,
      ent.canonicalName,
      [ent.canonicalName, ...ent.aliases],
    );

    let entityId: string;
    if (existing) {
      entityId = existing.id;
      entitiesReused += 1;
      const linked = await db.tickerEntity.findFirst({
        where: { tickerId: body.tickerId, entityId },
        select: { id: true },
      });
      if (!linked) {
        await db.tickerEntity.create({
          data: {
            tickerId: body.tickerId,
            entityId,
            source: "EXTRACTED",
          },
        });
      }
    } else {
      const created = await db.entity.create({
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
        await db.entityAlias.createMany({
          data: aliasRows,
          skipDuplicates: true,
        });
      }

      await db.tickerEntity.create({
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

  const issuerAnchor = await ensureTickerIssuerCompanyAnchor(db, body.tickerId);
  if (issuerAnchor) {
    const registerName = (raw: string) => {
      const k = normalizeAnalysisName(raw);
      if (!nameToEntityId.has(k)) {
        nameToEntityId.set(k, issuerAnchor.entityId);
      }
    };
    registerName(issuerAnchor.canonicalName);
    for (const a of issuerAnchor.aliases) {
      registerName(a);
    }
  }

  let relationsCreated = 0;
  const relationNameKeyToId = new Map<string, string>();
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

    const existingRel = await db.entityRelation.findUnique({
      where: {
        fromEntityId_toEntityId_relationTypeId: {
          fromEntityId: fromId,
          toEntityId: toId,
          relationTypeId: rel.relationTypeId,
        },
      },
      select: { id: true },
    });
    const relationId =
      existingRel?.id ??
      (
        await db.entityRelation.create({
          data: {
            fromEntityId: fromId,
            toEntityId: toId,
            relationTypeId: rel.relationTypeId,
          },
          select: { id: true },
        })
      ).id;
    if (!existingRel) {
      relationsCreated += 1;
    }
    relationNameKeyToId.set(buildRelationNameKey(rel), relationId);
  }

  let entityEvidenceUpserted = 0;
  for (const evidence of entityEvidence) {
    let entityId: string | undefined = nameToEntityId.get(
      normalizeAnalysisName(evidence.entityName),
    );
    if (entityId === undefined) {
      entityId =
        (await resolveEntityIdByNameForTicker(
          db,
          body.tickerId,
          evidence.entityName,
        )) ?? undefined;
    }
    if (entityId === undefined) {
      logger.warn(
        {
          tickerId: body.tickerId,
          entityName: evidence.entityName,
          dataSourceId: evidence.dataSourceId,
        },
        "entity evidence skipped: entityName not in ticker vocabulary",
      );
      continue;
    }

    await db.entityEvidence.upsert({
      where: {
        entityId_dataSourceId_tickerId: {
          entityId,
          dataSourceId: evidence.dataSourceId,
          tickerId: body.tickerId,
        },
      },
      create: {
        entityId,
        dataSourceId: evidence.dataSourceId,
        tickerId: body.tickerId,
        confidence: evidence.confidence ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        ...(evidence.confidence !== undefined && evidence.confidence !== null
          ? { confidence: evidence.confidence }
          : {}),
        lastSeenAt: new Date(),
      },
    });
    entityEvidenceUpserted += 1;
  }

  let relationEvidenceUpserted = 0;
  for (const evidence of relationEvidence) {
    let entityRelationId = relationNameKeyToId.get(
      buildRelationNameKey(evidence),
    );
    if (entityRelationId === undefined) {
      entityRelationId =
        (await resolveEntityRelationIdByNames(db, body.tickerId, evidence)) ??
        undefined;
    }
    if (entityRelationId === undefined) {
      logger.warn(
        {
          tickerId: body.tickerId,
          fromEntityName: evidence.fromEntityName,
          toEntityName: evidence.toEntityName,
          relationTypeId: evidence.relationTypeId,
          dataSourceId: evidence.dataSourceId,
        },
        "relation evidence skipped: relation not found for ticker vocabulary",
      );
      continue;
    }

    await db.entityRelationEvidence.upsert({
      where: {
        entityRelationId_dataSourceId_tickerId: {
          entityRelationId,
          dataSourceId: evidence.dataSourceId,
          tickerId: body.tickerId,
        },
      },
      create: {
        entityRelationId,
        dataSourceId: evidence.dataSourceId,
        tickerId: body.tickerId,
        confidence: evidence.confidence ?? null,
        evidenceSpan: evidence.evidenceSpan?.trim() ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        ...(evidence.confidence !== undefined && evidence.confidence !== null
          ? { confidence: evidence.confidence }
          : {}),
        ...(evidence.evidenceSpan !== undefined
          ? { evidenceSpan: evidence.evidenceSpan?.trim() ?? null }
          : {}),
        lastSeenAt: new Date(),
      },
    });
    relationEvidenceUpserted += 1;
  }

  for (const mention of body.articleEntities) {
    let entityId: string | undefined = nameToEntityId.get(
      normalizeAnalysisName(mention.entityName),
    );
    if (entityId === undefined) {
      entityId =
        (await resolveEntityIdByNameForTicker(
          db,
          body.tickerId,
          mention.entityName,
        )) ?? undefined;
    }
    if (entityId === undefined) {
      logger.warn(
        {
          tickerId: body.tickerId,
          entityName: mention.entityName,
          dataSourceId: mention.dataSourceId,
        },
        "article entity mention skipped: entityName not in ticker vocabulary",
      );
      continue;
    }

    await db.articleEntity.upsert({
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
    await db.articleRelevance.upsert({
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
    entityEvidenceUpserted,
    relationEvidenceUpserted,
  };
};

/**
 * Hard-deletes one data source row scoped by ticker id.
 *
 * @param body - Validated delete request with ticker and source ids.
 * @param deps - Injectable database delegates for tests.
 * @returns Whether a row was deleted.
 */
export const deleteAnalysisDataSource = async (
  body: PostAnalysisDataSourceDeleteBody,
  deps: { db?: Pick<AnalysisDb, "dataSource"> } = {},
): Promise<{ deleted: boolean }> => {
  const db = deps.db ?? defaultDb;
  const result = await db.dataSource.deleteMany({
    where: {
      id: body.dataSourceId,
      tickerId: body.tickerId,
    },
  });
  return {
    deleted: result.count > 0,
  };
};

/**
 * Finds an entity that matches canonical name or alias (case-insensitive) for a given type.
 *
 * @param db - Injectable database delegates for entity lookup.
 * @param typeId - Entity type UUID.
 * @param canonicalName - Primary name from the payload.
 * @param nameVariants - Canonical plus alias strings to match.
 * @returns Existing entity id or null.
 */
async function findReusableEntity(
  db: Pick<AnalysisWriteDb, "entity">,
  typeId: string,
  canonicalName: string,
  nameVariants: string[],
): Promise<{ id: string } | null> {
  const normalizedSet = new Set(
    nameVariants.map((n) => normalizeAnalysisName(n)),
  );
  const normalizedList = [...normalizedSet];

  return db.entity.findFirst({
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
 * @param db - Injectable database delegates for entity lookup.
 * @param tickerId - Ticker scope.
 * @param entityName - Mention name from the payload.
 * @returns Entity id or null.
 */
async function resolveEntityIdByNameForTicker(
  db: Pick<AnalysisWriteDb, "entity">,
  tickerId: string,
  entityName: string,
): Promise<string | null> {
  const n = normalizeAnalysisName(entityName);
  const entity = await db.entity.findFirst({
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

type RelationNameEvidence = Pick<
  PostAnalysisBody["relationEvidence"][number],
  "fromEntityName" | "toEntityName" | "relationTypeId"
>;

/**
 * Builds a normalized lookup key for relation endpoints and type id.
 *
 * @param relation - Relation or evidence row with endpoint names and type id.
 * @returns Stable map key for relation id resolution.
 */
const buildRelationNameKey = (relation: RelationNameEvidence): string =>
  `${normalizeAnalysisName(relation.fromEntityName)}\0${normalizeAnalysisName(relation.toEntityName)}\0${relation.relationTypeId}`;

/**
 * Resolves a canonical relation id by endpoint names for a ticker when not in the run-local map.
 *
 * @param db - Injectable database delegates for relation lookup.
 * @param tickerId - Ticker scope.
 * @param evidence - Relation evidence row with endpoint names.
 * @returns Entity relation id or null.
 */
async function resolveEntityRelationIdByNames(
  db: Pick<AnalysisWriteDb, "entity" | "entityRelation">,
  tickerId: string,
  evidence: RelationNameEvidence,
): Promise<string | null> {
  const fromEntity = await db.entity.findFirst({
    where: {
      tickerEntities: { some: { tickerId } },
      OR: [
        {
          canonicalName: {
            equals: evidence.fromEntityName.trim(),
            mode: "insensitive",
          },
        },
        {
          aliases: {
            some: {
              normalizedAlias: normalizeAnalysisName(evidence.fromEntityName),
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  const toEntity = await db.entity.findFirst({
    where: {
      tickerEntities: { some: { tickerId } },
      OR: [
        {
          canonicalName: {
            equals: evidence.toEntityName.trim(),
            mode: "insensitive",
          },
        },
        {
          aliases: {
            some: {
              normalizedAlias: normalizeAnalysisName(evidence.toEntityName),
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  if (!fromEntity || !toEntity) {
    return null;
  }

  const relation = await db.entityRelation.findUnique({
    where: {
      fromEntityId_toEntityId_relationTypeId: {
        fromEntityId: fromEntity.id,
        toEntityId: toEntity.id,
        relationTypeId: evidence.relationTypeId,
      },
    },
    select: { id: true },
  });
  return relation?.id ?? null;
}
