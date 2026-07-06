import { prisma, type Prisma } from "@mediapulse/database";
import { createSearchQuerySet } from "@mediapulse/domain-api/search-query-set-persist";
import type {
  GetQueryAnalysisQuery,
  PostQueryAnalysisBody,
} from "@workspace/agent-data-api-contract";

import {
  buildKgNeighborhood,
  buildPeerColumnFilters,
  collectRecentEventTypes,
  extractTickerSectorIndustry,
  mapPeersWithRelevance,
  QUERY_ANALYSIS_CALENDAR_EVENT_DAYS,
  QUERY_ANALYSIS_HEADLINE_LIMIT,
  QUERY_ANALYSIS_PEER_LIMIT,
  resolveHeadlinePublishedAt,
  sortAndLimitPeers,
  sourceNameFromUrl,
} from "./query-analysis-context-helpers";
import { getQueryYieldSummary } from "./search-query-yield";

/** Default rolling window for prior yield rollups on GET /query-analysis. */
export const QUERY_ANALYSIS_PRIOR_YIELD_WINDOW_DAYS = 30;

type QueryAnalysisDb = {
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow" | "findMany">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "findMany">;
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
  entityRelation: Pick<typeof prisma.entityRelation, "findMany">;
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
  entityRelation: prisma.entityRelation,
  searchQuerySet: prisma.searchQuerySet,
  searchQuery: prisma.searchQuery,
};

const entityRelationInclude = {
  fromEntity: { select: { canonicalName: true } },
  toEntity: { select: { canonicalName: true } },
  relationType: { select: { name: true } },
} satisfies Prisma.EntityRelationInclude;

/**
 * Builds query-analysis GET response data for one ticker.
 *
 * @param query - Validated query payload containing `tickerId`.
 * @param db - Optional injected DB delegates for testing.
 * @returns Ticker metadata, KG context, peers, calendar, headlines, and neighborhood.
 */
export const getQueryAnalysisContext = async (
  query: GetQueryAnalysisQuery,
  db: QueryAnalysisDb = defaultDb,
) => {
  const ticker = await db.ticker.findUniqueOrThrow({
    where: { id: query.tickerId },
  } satisfies Prisma.TickerFindUniqueOrThrowArgs);

  const topEntityRows = await db.tickerEntity.findMany({
    where: { tickerId: query.tickerId },
    include: { entity: { include: { type: true } } },
    take: 10,
    orderBy: { relevanceWeight: "desc" },
  } satisfies Prisma.TickerEntityFindManyArgs);

  const themeSourceArgs = {
    where: { tickerId: query.tickerId },
    select: { title: true },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  } satisfies Prisma.DataSourceFindManyArgs;

  const headlineSourceArgs = {
    where: { tickerId: query.tickerId },
    select: {
      title: true,
      url: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: "desc" as const },
    take: QUERY_ANALYSIS_HEADLINE_LIMIT,
  } satisfies Prisma.DataSourceFindManyArgs;

  const calendarWindowStart = new Date();
  calendarWindowStart.setDate(
    calendarWindowStart.getDate() - QUERY_ANALYSIS_CALENDAR_EVENT_DAYS,
  );
  const calendarSourceArgs = {
    where: {
      tickerId: query.tickerId,
      createdAt: { gte: calendarWindowStart },
    },
    select: { metadata: true },
    orderBy: { createdAt: "desc" as const },
  } satisfies Prisma.DataSourceFindManyArgs;

  const { sector, industry } = extractTickerSectorIndustry(ticker);
  const peerColumnFilters = buildPeerColumnFilters(sector, industry);
  const peerArgs =
    peerColumnFilters === undefined
      ? null
      : ({
          where: {
            id: { not: query.tickerId },
            OR: peerColumnFilters,
          },
          select: {
            id: true,
            symbol: true,
            name: true,
            metadataRaw: true,
          },
          take: QUERY_ANALYSIS_PEER_LIMIT * 4,
        } satisfies Prisma.TickerFindManyArgs);

  const entityIds = topEntityRows.map((row) => row.entityId);
  const kgNeighborhoodArgs =
    entityIds.length === 0
      ? null
      : ({
          where: {
            OR: [
              { fromEntityId: { in: entityIds } },
              { toEntityId: { in: entityIds } },
            ],
          },
          include: entityRelationInclude,
          orderBy: { weight: "desc" as const },
        } satisfies Prisma.EntityRelationFindManyArgs);

  const [
    recentSources,
    headlineSources,
    calendarSources,
    peerCandidates,
    kgRelations,
    priorYield,
  ] = await Promise.all([
    db.dataSource.findMany(themeSourceArgs),
    db.dataSource.findMany(headlineSourceArgs),
    db.dataSource.findMany(calendarSourceArgs),
    peerArgs ? db.ticker.findMany(peerArgs) : Promise.resolve([]),
    kgNeighborhoodArgs
      ? db.entityRelation.findMany(kgNeighborhoodArgs)
      : Promise.resolve([]),
    getQueryYieldSummary({
      tickerId: query.tickerId,
      windowDays: QUERY_ANALYSIS_PRIOR_YIELD_WINDOW_DAYS,
    }),
  ]);

  const peers = mapPeersWithRelevance(
    sortAndLimitPeers(peerCandidates).map((peer) => ({
      symbol: peer.symbol,
      name: peer.name,
    })),
  );

  return {
    ticker: {
      id: ticker.id,
      symbol: ticker.symbol,
      name: ticker.name,
      metadata: ticker.metadataRaw,
    },
    topEntities: topEntityRows.map((row) => ({
      canonicalName: row.entity.canonicalName,
      typeName: row.entity.type.name,
      relevanceWeight: row.relevanceWeight,
    })),
    recentThemes: recentSources.map((row) => ({
      theme: row.title,
      articleCount: 1,
    })),
    peers,
    calendar: {
      recentEventTypes: collectRecentEventTypes(calendarSources),
    },
    headlineSamples: headlineSources.map((row) => ({
      title: row.title,
      publishedAt: resolveHeadlinePublishedAt(row.metadata, row.createdAt),
      sourceName: sourceNameFromUrl(row.url),
    })),
    kgNeighborhood: buildKgNeighborhood(entityIds, kgRelations),
    priorYield,
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
