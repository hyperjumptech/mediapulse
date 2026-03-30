import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";
import type { PostQueryAnalysisBody } from "@workspace/agent-data-api-contract";

type QueryAnalysisDb = {
  ticker: Pick<typeof prisma.ticker, "findUnique">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "findMany">;
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
  articleEntity: Pick<typeof prisma.articleEntity, "groupBy">;
  entity: Pick<typeof prisma.entity, "findMany">;
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "findFirst" | "updateMany" | "create" | "update">;
  searchQuery: Pick<typeof prisma.searchQuery, "createMany">;
};

/**
 * Builds the generation context for the query-analysis agent GET endpoint.
 *
 * @param tickerId - Ticker id to build context for.
 * @param db - Optional database dependency for testing.
 * @returns Context object or null when the ticker does not exist.
 */
export const getQueryAnalysisContext = async (
  tickerId: string,
  db: Pick<QueryAnalysisDb, "ticker" | "tickerEntity" | "dataSource" | "articleEntity" | "entity"> = prisma,
) => {
  const ticker = await db.ticker.findUnique({
    where: { id: tickerId },
    select: { id: true, symbol: true, name: true, metadata: true },
  });

  if (!ticker) {
    return null;
  }

  // Top entities by relevance weight for this ticker
  const tickerEntities = await db.tickerEntity.findMany({
    where: { tickerId },
    include: {
      entity: {
        select: {
          canonicalName: true,
          type: { select: { name: true } },
        },
      },
    },
    orderBy: { relevanceWeight: "desc" },
    take: 20,
  });

  const topEntities = tickerEntities.map((te) => ({
    canonicalName: te.entity.canonicalName,
    typeName: te.entity.type.name,
    relevanceWeight: te.relevanceWeight,
  }));

  // Recent themes: top entity mentions from data sources within the last 14 days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentSources = await db.dataSource.findMany({
    where: { tickerId, createdAt: { gte: cutoff } },
    select: { id: true },
  });

  let recentThemes: { theme: string; articleCount: number }[] = [];

  if (recentSources.length > 0) {
    const sourceIds = recentSources.map((s) => s.id);
    const themeRows = await db.articleEntity.groupBy({
      by: ["entityId"],
      where: { dataSourceId: { in: sourceIds } },
      _sum: { mentionCount: true },
      orderBy: { _sum: { mentionCount: "desc" } },
      take: 10,
    });

    if (themeRows.length > 0) {
      const entityIds = themeRows.map((r) => r.entityId);
      const entities = await db.entity.findMany({
        where: { id: { in: entityIds } },
        select: { id: true, canonicalName: true },
      });
      const nameById = new Map(entities.map((e) => [e.id, e.canonicalName]));
      recentThemes = themeRows.map((r) => ({
        theme: nameById.get(r.entityId) ?? r.entityId,
        articleCount: r._sum.mentionCount ?? 0,
      }));
    }
  }

  return { ticker, topEntities, recentThemes };
};

/**
 * Persists a new versioned query set as the active set for the ticker (atomic swap).
 *
 * @param body - Validated POST body from the query-analysis agent.
 * @param db - Optional database dependency for testing.
 * @returns Created count, new set id, and active set id.
 */
export const persistQuerySet = async (
  body: PostQueryAnalysisBody,
  db: Pick<QueryAnalysisDb, "searchQuerySet" | "searchQuery"> = prisma,
) => {
  // 1. Create the new set (inactive to start)
  const newSet = await db.searchQuerySet.create({
    data: {
      tickerId: body.tickerId,
      strategySnapshot: body.strategySnapshot as Prisma.InputJsonValue,
      generationSource: body.generationSource,
      agentJobId: body.agentJobId ?? null,
      isActive: false,
    },
  });

  // 2. Bulk-insert queries belonging to this set
  await db.searchQuery.createMany({
    data: body.queries.map((q) => ({
      text: q.text,
      tickerId: body.tickerId,
      setId: newSet.id,
      source: q.source === "deterministic" ? ("DETERMINISTIC" as const) : ("LLM" as const),
      intent:
        q.intent === "breaking"
          ? ("BREAKING" as const)
          : q.intent === "kg_change"
            ? ("KG_CHANGE" as const)
            : ("FUNDAMENTAL" as const),
      rank: q.rank,
    })),
  });

  // 3. Deactivate all previous active sets for this ticker
  await db.searchQuerySet.updateMany({
    where: { tickerId: body.tickerId, isActive: true },
    data: { isActive: false },
  });

  // 4. Activate the new set
  await db.searchQuerySet.update({
    where: { id: newSet.id },
    data: { isActive: true },
  });

  logger.info(
    { tickerId: body.tickerId, setId: newSet.id, created: body.queries.length },
    "Query set persisted and activated",
  );

  return {
    created: body.queries.length,
    setId: newSet.id,
    activeSetId: newSet.id,
  };
};
