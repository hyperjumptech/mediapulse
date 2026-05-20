import { prisma, type Prisma } from "@mediapulse/database";
import { createSearchQuerySet } from "@mediapulse/domain-api/search-query-set-persist";
import type {
  GetQueryAnalysisQuery,
  PostQueryAnalysisBody,
} from "@workspace/agent-data-api-contract";

type QueryAnalysisDb = {
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "findMany">;
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
  searchQuerySet: Pick<
    typeof prisma.searchQuerySet,
    "updateMany" | "create" | "update" | "findUnique" | "delete"
  >;
  searchQuery: Pick<typeof prisma.searchQuery, "deleteMany" | "createMany">;
};

const defaultDb: QueryAnalysisDb = {
  ticker: prisma.ticker,
  tickerEntity: prisma.tickerEntity,
  dataSource: prisma.dataSource,
  searchQuerySet: prisma.searchQuerySet,
  searchQuery: prisma.searchQuery,
};

/**
 * Builds query-analysis GET response data for one ticker.
 *
 * @param query - Validated query payload containing `tickerId`.
 * @param db - Optional injected DB delegates for testing.
 * @returns Ticker metadata, top entities, and recent themes.
 */
export const getQueryAnalysisContext = async (
  query: GetQueryAnalysisQuery,
  db: QueryAnalysisDb = defaultDb,
) => {
  const ticker = await db.ticker.findUniqueOrThrow({
    where: { id: query.tickerId },
  } satisfies Prisma.TickerFindUniqueOrThrowArgs);

  const topEntities = await db.tickerEntity.findMany({
    where: { tickerId: query.tickerId },
    include: { entity: { include: { type: true } } },
    take: 10,
    orderBy: { relevanceWeight: "desc" },
  } satisfies Prisma.TickerEntityFindManyArgs);

  const recentSources = await db.dataSource.findMany({
    where: { tickerId: query.tickerId },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  } satisfies Prisma.DataSourceFindManyArgs);

  return {
    ticker: {
      id: ticker.id,
      symbol: ticker.symbol,
      name: ticker.name,
      metadata: ticker.metadata,
    },
    topEntities: topEntities.map((row) => ({
      canonicalName: row.entity.canonicalName,
      typeName: row.entity.type.name,
      relevanceWeight: row.relevanceWeight,
    })),
    recentThemes: recentSources.map((row) => ({
      theme: row.title,
      articleCount: 1,
    })),
  };
};

/**
 * Persists and activates a new query set for the provided ticker.
 *
 * @param body - Validated POST payload with generated queries and metadata.
 * @param db - Optional injected DB delegates for testing.
 * @returns Created query count and active set identifiers.
 */
export const createAndActivateQuerySet = async (
  body: PostQueryAnalysisBody,
  db: QueryAnalysisDb = defaultDb,
) => {
  const { id, queryCount } = await createSearchQuerySet(
    {
      tickerId: body.tickerId,
      isActive: body.activate,
      generationSource: body.generationSource,
      strategySnapshot: body.strategySnapshot,
      agentJobId: body.agentJobId,
      queries: body.queries,
    },
    db,
  );

  return {
    created: queryCount,
    createdSetId: id,
    activeSetId: id,
  };
};
