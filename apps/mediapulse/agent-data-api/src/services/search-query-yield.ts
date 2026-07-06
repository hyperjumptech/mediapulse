import { prisma, type Prisma } from "@mediapulse/database";

type SearchQueryYieldDb = {
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
  searchQueryYield: Pick<typeof prisma.searchQueryYield, "upsert" | "findMany">;
  searchQuery: Pick<typeof prisma.searchQuery, "findMany">;
};

const defaultDb: SearchQueryYieldDb = {
  dataSource: prisma.dataSource,
  searchQueryYield: prisma.searchQueryYield,
  searchQuery: prisma.searchQuery,
};

/** UTC midnight bounds for a calendar date. */
export type UtcDayBounds = {
  start: Date;
  end: Date;
};

/**
 * Returns inclusive UTC day bounds for a calendar date (defaults to today UTC).
 *
 * @param runDate - Calendar date to bound (time portion ignored).
 * @returns Start (inclusive) and end (exclusive) instants in UTC.
 */
export const utcDayBoundsForDate = (
  runDate: Date = new Date(),
): UtcDayBounds => {
  const start = new Date(
    Date.UTC(
      runDate.getUTCFullYear(),
      runDate.getUTCMonth(),
      runDate.getUTCDate(),
    ),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

/**
 * Normalizes a calendar date to UTC midnight for stable `runDate` storage.
 *
 * @param runDate - Input date.
 * @returns UTC date at midnight.
 */
export const toUtcRunDate = (runDate: Date): Date =>
  utcDayBoundsForDate(runDate).start;

type DailyQueryCounts = {
  searchQueryId: string;
  articleCount: number;
  novelArticleCount: number;
};

/**
 * Computes per-query article and novel counts from ingested data sources for one UTC day.
 *
 * @param params - Ticker scope, day bounds, and optional DB delegates.
 * @returns Aggregated counts keyed by search query id.
 */
export const computeDailyQueryYieldCounts = async (
  params: {
    tickerId: string;
    dayBounds: UtcDayBounds;
  },
  db: SearchQueryYieldDb = defaultDb,
): Promise<DailyQueryCounts[]> => {
  const sources = await db.dataSource.findMany({
    where: {
      tickerId: params.tickerId,
      createdAt: {
        gte: params.dayBounds.start,
        lt: params.dayBounds.end,
      },
    },
    select: {
      id: true,
      url: true,
      searchQueryId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  } satisfies Prisma.DataSourceFindManyArgs);

  if (sources.length === 0) {
    return [];
  }

  const earliestByUrl = new Map<
    string,
    { searchQueryId: string; createdAt: Date }
  >();
  const allSourcesForTicker = await db.dataSource.findMany({
    where: { tickerId: params.tickerId },
    select: {
      url: true,
      searchQueryId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  } satisfies Prisma.DataSourceFindManyArgs);

  for (const row of allSourcesForTicker) {
    if (row.searchQueryId === null) {
      continue;
    }
    if (!earliestByUrl.has(row.url)) {
      earliestByUrl.set(row.url, {
        searchQueryId: row.searchQueryId,
        createdAt: row.createdAt,
      });
    }
  }

  const counts = new Map<
    string,
    { articleCount: number; novelArticleCount: number }
  >();

  for (const source of sources) {
    if (source.searchQueryId === null) {
      continue;
    }
    const bucket = counts.get(source.searchQueryId) ?? {
      articleCount: 0,
      novelArticleCount: 0,
    };
    bucket.articleCount += 1;

    const earliest = earliestByUrl.get(source.url);
    if (
      earliest !== undefined &&
      earliest.searchQueryId === source.searchQueryId &&
      earliest.createdAt >= params.dayBounds.start &&
      earliest.createdAt < params.dayBounds.end
    ) {
      bucket.novelArticleCount += 1;
    }

    counts.set(source.searchQueryId, bucket);
  }

  return [...counts.entries()].map(([searchQueryId, value]) => ({
    searchQueryId,
    articleCount: value.articleCount,
    novelArticleCount: value.novelArticleCount,
  }));
};

/**
 * Upserts daily `SearchQueryYield` rows for one ticker and UTC calendar date.
 *
 * @param params - Ticker id and optional run date (defaults to today UTC).
 * @param db - Optional injected DB delegates for testing.
 * @returns Number of yield rows written.
 */
export const aggregateSearchQueryYieldForTicker = async (
  params: {
    tickerId: string;
    runDate?: Date;
  },
  db: SearchQueryYieldDb = defaultDb,
): Promise<number> => {
  const runDate = toUtcRunDate(params.runDate ?? new Date());
  const dayBounds = utcDayBoundsForDate(runDate);
  const counts = await computeDailyQueryYieldCounts(
    { tickerId: params.tickerId, dayBounds },
    db,
  );

  const computedAt = new Date();
  for (const row of counts) {
    await db.searchQueryYield.upsert({
      where: {
        searchQueryId_runDate: {
          searchQueryId: row.searchQueryId,
          runDate,
        },
      },
      create: {
        searchQueryId: row.searchQueryId,
        runDate,
        articleCount: row.articleCount,
        novelArticleCount: row.novelArticleCount,
        computedAt,
      },
      update: {
        articleCount: row.articleCount,
        novelArticleCount: row.novelArticleCount,
        computedAt,
      },
    } satisfies Prisma.SearchQueryYieldUpsertArgs);
  }

  return counts.length;
};
