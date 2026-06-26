import type {
  GetAnalysisQuery,
  GetAnalysisResponse,
  PostAnalysisDataSourceDeleteBody,
  PostAnalysisBody,
  PostAnalysisResponse,
} from "@workspace/agent-data-api-contract";
import { prisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";

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

  const where = {
    collectionGateStatus: "passed" as const,
    ...(query.unanalyzed ? { analyzedAt: null } : {}),
  } satisfies Prisma.DataSourceWhereInput;

  const [dataSources, dataSourceTotalCount] = await Promise.all([
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
      },
    } satisfies Prisma.DataSourceFindManyArgs),
    db.dataSource.count({ where }),
  ]);

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
