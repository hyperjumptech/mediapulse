import type {
  GetAnalysisQuery,
  GetAnalysisResponse,
  PostAnalysisDataSourceDeleteBody,
  PostAnalysisBody,
  PostAnalysisResponse,
} from "@workspace/agent-data-api-contract";
import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";

import {
  extractTickerBusinessContext,
  extractTickerSectorIndustry,
} from "./query-analysis-context-helpers";

/**
 * Thrown when the analysis POST body references data sources that do not exist.
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
    "findMany" | "count" | "update" | "updateMany" | "deleteMany"
  >;
  $transaction: typeof prisma.$transaction;
};

const defaultDb: AnalysisDb = prisma;

/** Maps a joined ticker row into the per-article issuer context, reusing the metadata extractors. */
const mapTickerContext = (
  ticker: { symbol: string; name: string; metadata: unknown } | null,
): GetAnalysisResponse["dataSources"][number]["ticker"] => {
  if (ticker === null) {
    return null;
  }
  const { sector, industry } = extractTickerSectorIndustry(ticker.metadata);
  const { subIndustry, businessActivity } = extractTickerBusinessContext(
    ticker.metadata,
  );

  return {
    symbol: ticker.symbol,
    name: ticker.name,
    sector: sector ?? null,
    industry: industry ?? null,
    subIndustry: subIndustry ?? null,
    businessActivity: businessActivity ?? null,
  };
};

/**
 * Loads unanalyzed articles (any ticker) for the article-analysis agent to classify.
 *
 * @param query - Parsed GET query (`unanalyzed` defaults to incremental backlog only).
 * @param deps - Injectable database delegates for tests.
 * @returns Eligible data sources (oldest first, capped by `limit`) plus the total backlog count.
 */
export const loadAnalysisContext = async (
  query: GetAnalysisQuery,
  deps: { db?: Pick<AnalysisDb, "dataSource"> } = {},
): Promise<GetAnalysisResponse> => {
  const db = deps.db ?? defaultDb;

  const createdAtWhere =
    query.start !== undefined || query.end !== undefined
      ? ({
          ...(query.start !== undefined ? { gte: new Date(query.start) } : {}),
          ...(query.end !== undefined ? { lte: new Date(query.end) } : {}),
        } satisfies Prisma.DateTimeFilter)
      : undefined;

  const where = {
    // Ticker-scoped requests (data-collection daily baseline) count every source for the
    // ticker in the window; ticker-agnostic requests (article-analysis) only see gated articles.
    ...(query.tickerId !== undefined
      ? { tickerId: query.tickerId }
      : { collectionGateStatus: "passed" as const }),
    ...(createdAtWhere ? { createdAt: createdAtWhere } : {}),
    ...(query.unanalyzed ? { analyzedAt: null } : {}),
  } satisfies Prisma.DataSourceWhereInput;

  const [rows, dataSourceTotalCount] = await Promise.all([
    db.dataSource.findMany({
      where,
      orderBy: { createdAt: "asc" },
      ...(query.limit ? { take: query.limit } : {}),
      select: {
        id: true,
        url: true,
        title: true,
        content: true,
        createdAt: true,
        ticker: { select: { symbol: true, name: true, metadata: true } },
      },
    } satisfies Prisma.DataSourceFindManyArgs),
    db.dataSource.count({ where }),
  ]);

  const dataSources = rows.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt,
    ticker: mapTickerContext(row.ticker),
  }));

  return { dataSources, dataSourceTotalCount };
};

/**
 * Persists per-article section classifications onto their data sources and marks them analyzed.
 *
 * @param body - Validated analysis POST body (section rows + analyzed ids).
 * @param deps - Injectable database delegates for tests.
 * @returns Counts of scored and rejected (section `null`) rows.
 * @throws {AnalysisPostValidationError} When a referenced data source does not exist.
 */
export const applyAnalysisPost = async (
  body: PostAnalysisBody,
  deps: { db?: AnalysisDb } = {},
): Promise<PostAnalysisResponse> => {
  const db = deps.db ?? defaultDb;

  const referencedIds = new Set<string>([
    ...body.articleSections.map((row) => row.dataSourceId),
    ...body.analyzedDataSourceIds,
  ]);

  if (referencedIds.size > 0) {
    const existing = await db.dataSource.findMany({
      where: { id: { in: [...referencedIds] } },
      select: { id: true },
    } satisfies Prisma.DataSourceFindManyArgs);
    const existingIds = new Set(existing.map((row) => row.id));
    const missing = [...referencedIds].filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new AnalysisPostValidationError(
        `Unknown data source ids: ${missing.join(", ")}`,
      );
    }
  }

  const writes: Prisma.PrismaPromise<unknown>[] = body.articleSections.map(
    (row) =>
      db.dataSource.update({
        where: { id: row.dataSourceId },
        data: {
          section: row.section,
          sectionScore: row.score,
          sectionReason: row.reason,
        },
      }),
  );

  if (body.analyzedDataSourceIds.length > 0) {
    writes.push(
      db.dataSource.updateMany({
        where: { id: { in: body.analyzedDataSourceIds } },
        data: { analyzedAt: new Date() },
      }),
    );
  }

  if (writes.length > 0) {
    await db.$transaction(writes);
  }

  const articlesRejected = body.articleSections.filter(
    (row) => row.section === null,
  ).length;

  return {
    articlesScored: body.articleSections.length,
    articlesRejected,
  };
};

/**
 * Hard-deletes a data source (used by the analysis data-source delete route).
 *
 * @param body - Delete request body (data source id + ticker scope).
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
