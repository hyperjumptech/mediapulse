import { prisma, type Prisma } from "@mediapulse/database";
import type {
  GetQueryAnalysisQuery,
  PostQueryAnalysisBody,
} from "@workspace/agent-data-api-contract";

type QueryAnalysisDb = {
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "findMany">;
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "updateMany" | "create">;
};

const defaultDb: QueryAnalysisDb = {
  ticker: prisma.ticker,
  tickerEntity: prisma.tickerEntity,
  dataSource: prisma.dataSource,
  searchQuerySet: prisma.searchQuerySet,
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
  await db.searchQuerySet.updateMany({
    where: { tickerId: body.tickerId, isActive: true },
    data: { isActive: false },
  } satisfies Prisma.SearchQuerySetUpdateManyArgs);

  const createdSet = await db.searchQuerySet.create({
    data: {
      tickerId: body.tickerId,
      isActive: body.activate,
      generatedAt: new Date(),
      generationSource: body.generationSource,
      strategySnapshot: body.strategySnapshot as Prisma.InputJsonObject,
      agentJobId: body.agentJobId,
      searchQueries: {
        create: body.queries.map((query) => ({
          tickerId: body.tickerId,
          text: query.text,
          source: query.source,
          intent: query.intent,
          rank: query.rank,
        })),
      },
    },
  } satisfies Prisma.SearchQuerySetCreateArgs);

  return {
    created: body.queries.length,
    createdSetId: createdSet.id,
    activeSetId: createdSet.id,
  };
};
