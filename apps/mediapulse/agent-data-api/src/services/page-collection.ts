import type { Prisma } from "@mediapulse/database";
import type {
  GetPageCollectionArticlesQuery,
  GetPageCollectionArticlesResponse,
  PostPageCollectionBody,
  PostPageCollectionExistingUrlsBody,
  PostPageCollectionResolveSourcesBody,
} from "@workspace/agent-data-api-contract";
import { canonicalizeUrl } from "@workspace/utils";
import { prisma } from "@mediapulse/database";

import { insertDataSourcesIdempotently } from "./insert-data-sources-idempotently.js";

type PageCollectionDb = Pick<typeof prisma, "curatedSource" | "dataSource">;

const defaultDb: PageCollectionDb = prisma;

/**
 * Persists ticker-agnostic articles collected by page-collection.
 *
 * @param rows - Article payloads with curated source listing URL.
 * @param deps - Injectable database delegates.
 */
export const persistPageCollectionArticles = async (
  rows: PostPageCollectionBody,
  deps: { db?: PageCollectionDb } = {},
): Promise<number> => {
  const db = deps.db ?? defaultDb;

  if (rows.length === 0) {
    return 0;
  }

  const listingUrls = [...new Set(rows.map((r) => r.curatedSourceListingUrl))];
  const sourceRows = await db.curatedSource.findMany({
    where: { listingUrl: { in: listingUrls } },
    select: { id: true, listingUrl: true },
  } satisfies Prisma.CuratedSourceFindManyArgs);

  const sourceByUrl = new Map(sourceRows.map((s) => [s.listingUrl, s.id]));

  const createData = rows.map((row) => {
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeUrl(row.url);
    } catch {
      canonicalUrl = row.url;
    }

    const curatedSourceId =
      sourceByUrl.get(row.curatedSourceListingUrl) ?? null;

    return {
      url: row.url,
      canonicalUrl,
      title: row.title,
      content: row.content,
      tickerId: null,
      searchQueryId: null,
      curatedSourceId,
      collectionGateStatus: row.collectionGateStatus,
      collectionGateReason: row.collectionGateReason ?? null,
      ...(row.publishedAt ? { publishedAt: new Date(row.publishedAt) } : {}),
      ...(row.metadata
        ? { metadata: row.metadata as Prisma.InputJsonValue }
        : {}),
    } satisfies Prisma.DataSourceCreateManyInput;
  });

  return insertDataSourcesIdempotently(createData, {
    dataSource: db.dataSource,
  });
};

/**
 * Returns global article URLs that already exist (ticker_id IS NULL).
 *
 * @param body - Candidate URLs to check.
 * @param deps - Injectable database delegates.
 */
export const lookupGlobalExistingUrls = async (
  body: PostPageCollectionExistingUrlsBody,
  deps: { db?: Pick<typeof prisma.dataSource, "findMany"> } = {},
): Promise<string[]> => {
  const dataSource = deps.db ?? prisma.dataSource;
  const uniqueRequested = [...new Set(body.urls)];

  if (uniqueRequested.length === 0) {
    return [];
  }

  const findArgs = {
    where: {
      tickerId: null,
      canonicalUrl: {
        in: uniqueRequested.map((url) => {
          try {
            return canonicalizeUrl(url);
          } catch {
            return url;
          }
        }),
      },
    },
    select: { canonicalUrl: true },
  } satisfies Prisma.DataSourceFindManyArgs;

  const rows = await dataSource.findMany(findArgs);
  return rows.map((r: { canonicalUrl: string }) => r.canonicalUrl);
};

/**
 * Resolves curated source ids and maxItems for listing URLs.
 *
 * @param body - Listing URLs from the agent input.
 * @param deps - Injectable database delegates.
 */
export const resolveCuratedSourcesByListingUrls = async (
  body: PostPageCollectionResolveSourcesBody,
  deps: { db?: Pick<typeof prisma.curatedSource, "findMany"> } = {},
) => {
  const curatedSource = deps.db ?? prisma.curatedSource;
  const findManyArgs = {
    where: { listingUrl: { in: body.listingUrls }, enabled: true },
    select: { id: true, listingUrl: true, linkType: true, maxItems: true },
  } satisfies Prisma.CuratedSourceFindManyArgs;

  const rows = await curatedSource.findMany(findManyArgs);

  type ResolvedCuratedSourceRow = Prisma.CuratedSourceGetPayload<{
    select: typeof findManyArgs.select;
  }>;

  return {
    sources: rows.map((row: ResolvedCuratedSourceRow) => ({
      listingUrl: row.listingUrl,
      curatedSourceId: row.id,
      linkType: row.linkType,
      maxItems: row.maxItems,
    })),
  };
};

/**
 * Lists page-collection articles with optional gate and analysis filters.
 *
 * @param query - Pagination and filter params.
 * @param deps - Injectable database delegates.
 */
export const listPageCollectionArticles = async (
  query: GetPageCollectionArticlesQuery,
  deps: { db?: Pick<typeof prisma.dataSource, "findMany" | "count"> } = {},
): Promise<GetPageCollectionArticlesResponse> => {
  const dataSource = deps.db ?? prisma.dataSource;
  const page = query.page;
  const pageSize = query.pageSize;
  const skip = (page - 1) * pageSize;

  const where = {
    tickerId: null,
    ...(query.gateStatus ? { collectionGateStatus: query.gateStatus } : {}),
    ...(query.curatedSourceId
      ? { curatedSourceId: query.curatedSourceId }
      : {}),
    ...(query.unanalyzed === true ? { analyzedAt: null } : {}),
  } satisfies Prisma.DataSourceWhereInput;

  const findArgs = {
    where,
    orderBy: { createdAt: "desc" as const },
    skip,
    take: pageSize,
    select: {
      id: true,
      url: true,
      title: true,
      collectionGateStatus: true,
      collectionGateReason: true,
      curatedSourceId: true,
      analyzedAt: true,
      createdAt: true,
      curatedSource: { select: { listingUrl: true } },
    },
  } satisfies Prisma.DataSourceFindManyArgs;

  const countArgs = { where } satisfies Prisma.DataSourceCountArgs;

  const [rows, total] = await Promise.all([
    dataSource.findMany(findArgs),
    dataSource.count(countArgs),
  ]);

  return {
    items: rows.map((row: (typeof rows)[number]) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      collectionGateStatus: row.collectionGateStatus,
      collectionGateReason: row.collectionGateReason,
      curatedSourceId: row.curatedSourceId,
      curatedSourceListingUrl: row.curatedSource?.listingUrl ?? null,
      analyzedAt: row.analyzedAt,
      createdAt: row.createdAt,
    })),
    total,
    page,
    pageSize,
  };
};
