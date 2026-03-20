import { prisma } from "@workspace/database";

import type {
  GetQueryAnalysisResponse,
  PostQueryAnalysisBody,
  PostQueryAnalysisResponse,
} from "../schemas/query-analysis.js";

type QueryAnalysisDb = {
  ticker: {
    findUnique: (args: Record<string, unknown>) => Promise<{
      id: string;
      symbol: string;
      name: string;
      metadata: unknown | null;
    } | null>;
  };
  tickerEntity: {
    findMany: (args: Record<string, unknown>) => Promise<
      Array<{
        relevanceWeight: number;
        entity: {
          canonicalName: string;
          type: {
            name: string;
          };
        };
      }>
    >;
  };
  articleEntity: {
    groupBy: (args: Record<string, unknown>) => Promise<
      Array<{
        entityId: string;
        _count: { entityId: number };
      }>
    >;
  };
  entity: {
    findMany: (args: Record<string, unknown>) => Promise<
      Array<{
        id: string;
        canonicalName: string;
      }>
    >;
  };
  searchQuery: {
    deleteMany: (args: Record<string, unknown>) => Promise<unknown>;
    createMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
};

/**
 * Fetches query-analysis context for a ticker, including top KG entities and recent TOPIC themes.
 *
 * @param tickerId - The ticker UUID.
 * @param db - The database client dependency, defaults to prisma.
 * @returns Ticker metadata, top entities, and recent themes.
 */
export const getQueryAnalysisData = async (
  tickerId: string,
  db: QueryAnalysisDb = prisma as unknown as QueryAnalysisDb,
): Promise<GetQueryAnalysisResponse> => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [ticker, topTickerEntities, groupedThemes] = await Promise.all([
    db.ticker.findUnique({
      where: { id: tickerId },
      select: { id: true, symbol: true, name: true, metadata: true },
    }),
    db.tickerEntity.findMany({
      where: { tickerId },
      orderBy: { relevanceWeight: "desc" },
      take: 20,
      include: {
        entity: {
          select: {
            canonicalName: true,
            type: { select: { name: true } },
          },
        },
      },
    }),
    db.articleEntity.groupBy({
      by: ["entityId"],
      where: {
        entity: { type: { name: "TOPIC" } },
        dataSource: {
          tickerId,
          createdAt: { gte: since },
        },
      },
      _count: { entityId: true },
      orderBy: { _count: { entityId: "desc" } },
      take: 10,
    }),
  ]);

  if (!ticker) {
    throw new Error(`Ticker ${tickerId} not found`);
  }

  const themeEntityIds = groupedThemes.map((row) => row.entityId);
  const themeEntities =
    themeEntityIds.length > 0
      ? await db.entity.findMany({
          where: { id: { in: themeEntityIds } },
          select: { id: true, canonicalName: true },
        })
      : [];

  const themeById = new Map(
    themeEntities.map((entity) => [entity.id, entity.canonicalName]),
  );

  return {
    ticker,
    topEntities: topTickerEntities.map((row) => ({
      canonicalName: row.entity.canonicalName,
      typeName: row.entity.type.name,
      relevanceWeight: row.relevanceWeight,
    })),
    recentThemes: groupedThemes
      .map((row) => ({
        theme: themeById.get(row.entityId),
        articleCount: row._count.entityId,
      }))
      .filter((row): row is { theme: string; articleCount: number } =>
        Boolean(row.theme),
      ),
  };
};

/**
 * Replaces stale query-analysis search queries for a ticker with fresh ones.
 *
 * @param data - The ticker id and query text payload.
 * @param db - The database client dependency, defaults to prisma.
 * @returns The number of newly created search query records.
 */
export const createSearchQueries = async (
  data: PostQueryAnalysisBody,
  db: QueryAnalysisDb = prisma as unknown as QueryAnalysisDb,
): Promise<PostQueryAnalysisResponse> => {
  const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await db.searchQuery.deleteMany({
    where: {
      tickerId: data.tickerId,
      createdAt: { lt: staleBefore },
    },
  });

  if (data.queries.length === 0) {
    return { created: 0 };
  }

  const created = await db.searchQuery.createMany({
    data: data.queries.map((query) => ({
      text: query.text,
      tickerId: data.tickerId,
    })),
  });

  return { created: created.count };
};
