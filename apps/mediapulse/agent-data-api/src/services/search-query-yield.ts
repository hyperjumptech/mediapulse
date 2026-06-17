import { prisma, type Prisma } from "@mediapulse/database";
import type {
  QueryAnalysisIntent,
  QueryAnalysisPriorYield,
} from "@workspace/agent-data-api-contract";

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

type QueryAttributionEntry = {
  text?: string;
  source?: string;
  intent?: string;
  persona?: string;
};

/**
 * Parses optional query attribution rows stored on a strategy snapshot.
 *
 * @param strategySnapshot - Persisted strategy snapshot JSON.
 * @returns Normalized attribution entries keyed by normalized query text.
 */
export const parseQueryAttributionByText = (
  strategySnapshot: unknown,
): Map<string, QueryAttributionEntry> => {
  const map = new Map<string, QueryAttributionEntry>();
  if (
    strategySnapshot === null ||
    typeof strategySnapshot !== "object" ||
    !("queryAttribution" in strategySnapshot)
  ) {
    return map;
  }
  const raw = (strategySnapshot as { queryAttribution?: unknown })
    .queryAttribution;
  if (!Array.isArray(raw)) {
    return map;
  }
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const text =
      "text" in entry && typeof entry.text === "string"
        ? entry.text
        : undefined;
    if (text === undefined) {
      continue;
    }
    const key = text.trim().replace(/\s+/g, " ").toLowerCase();
    map.set(key, entry as QueryAttributionEntry);
  }
  return map;
};

type YieldAccumulator = {
  articleTotal: number;
  novelTotal: number;
  sampleCount: number;
};

/**
 * Records one yield sample into a keyed accumulator map.
 *
 * @param map - Mutable accumulator map.
 * @param key - Bucket key (template id, intent, or persona).
 * @param articleCount - Daily article count for the sample.
 * @param novelArticleCount - Daily novel article count for the sample.
 */
export const accumulateYieldSample = (
  map: Map<string, YieldAccumulator>,
  key: string,
  articleCount: number,
  novelArticleCount: number,
): void => {
  const bucket = map.get(key) ?? {
    articleTotal: 0,
    novelTotal: 0,
    sampleCount: 0,
  };
  bucket.articleTotal += articleCount;
  bucket.novelTotal += novelArticleCount;
  bucket.sampleCount += 1;
  map.set(key, bucket);
};

/**
 * Converts accumulator buckets into averaged yield rows.
 *
 * @param map - Accumulator keyed by bucket id.
 * @param idField - Property name for the bucket identifier.
 * @returns Averaged yield buckets sorted by id.
 */
export const finalizeYieldBuckets = <TId extends string>(
  map: Map<string, YieldAccumulator>,
  idField: TId,
): Array<Record<TId, string> & { avgArticles: number; avgNovel: number }> => {
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, bucket]) => ({
      [idField]: id,
      avgArticles:
        bucket.sampleCount > 0 ? bucket.articleTotal / bucket.sampleCount : 0,
      avgNovel:
        bucket.sampleCount > 0 ? bucket.novelTotal / bucket.sampleCount : 0,
    })) as Array<
    Record<TId, string> & { avgArticles: number; avgNovel: number }
  >;
};

/**
 * Builds rolling yield rollups for template, intent, and persona dimensions.
 *
 * @param params - Ticker id and rolling window length in days.
 * @param db - Optional injected DB delegates for testing.
 * @returns Per-dimension average yield buckets for GET /query-analysis.
 */
export const getQueryYieldSummary = async (
  params: {
    tickerId: string;
    windowDays: number;
  },
  db: SearchQueryYieldDb = defaultDb,
): Promise<QueryAnalysisPriorYield> => {
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - params.windowDays);
  windowStart.setUTCHours(0, 0, 0, 0);

  const yieldRows = await db.searchQueryYield.findMany({
    where: {
      runDate: { gte: windowStart },
      searchQuery: { tickerId: params.tickerId },
    },
    include: {
      searchQuery: {
        select: {
          text: true,
          intent: true,
          source: true,
          set: {
            select: {
              strategySnapshot: true,
            },
          },
        },
      },
    },
    orderBy: { runDate: "desc" },
  } satisfies Prisma.SearchQueryYieldFindManyArgs);

  const perIntent = new Map<string, YieldAccumulator>();
  const perPersona = new Map<string, YieldAccumulator>();

  for (const row of yieldRows) {
    const query = row.searchQuery;
    const textKey = query.text.trim().replace(/\s+/g, " ").toLowerCase();
    const attribution = parseQueryAttributionByText(
      query.set?.strategySnapshot,
    ).get(textKey);

    accumulateYieldSample(
      perIntent,
      query.intent,
      row.articleCount,
      row.novelArticleCount,
    );

    const persona = attribution?.persona;
    if (persona !== undefined) {
      accumulateYieldSample(
        perPersona,
        persona,
        row.articleCount,
        row.novelArticleCount,
      );
    }
  }

  return {
    perIntent: finalizeYieldBuckets(perIntent, "intent").map((row) => ({
      ...row,
      intent: row.intent as QueryAnalysisIntent,
    })),
    perPersona: finalizeYieldBuckets(perPersona, "persona"),
  };
};
