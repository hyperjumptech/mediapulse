import { prisma, type Prisma } from "@mediapulse/database";

type SearchQueriesDb = {
  searchQuery: Pick<typeof prisma.searchQuery, "findMany" | "count">;
};

type SearchQueryRow = Prisma.SearchQueryGetPayload<{
  include: { ticker: { select: { name: true; symbol: true } } };
}>;

export type SearchQueriesPageResult = {
  searchQueries: SearchQueryRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for ticker-name filtering (partial, case-insensitive).
 *
 * @param tickerNameFilter - Raw ticker-name filter; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no filter.
 */
const searchQueryTickerWhere = (
  tickerNameFilter: string | undefined,
): Prisma.SearchQueryWhereInput | undefined => {
  const term = tickerNameFilter?.trim();
  if (!term) return undefined;

  return {
    ticker: {
      name: { contains: term, mode: "insensitive" },
    },
  };
};

/**
 * Fetches paginated search queries with related ticker info, optionally filtered by ticker name.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of rows per page.
 * @param options - Optional ticker-name filter.
 * @param db - Prisma collaborators (injectable for tests).
 * @returns Search query rows plus pagination metadata.
 */
export const getSearchQueriesPage = async (
  page: number,
  pageSize: number,
  options?: { tickerNameFilter?: string },
  db: SearchQueriesDb = prisma,
): Promise<SearchQueriesPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = searchQueryTickerWhere(options?.tickerNameFilter);

  const findManyArgs = {
    where,
    include: {
      ticker: {
        select: {
          name: true,
          symbol: true,
        },
      },
    },
    skip,
    take: pageSize,
    orderBy: { createdAt: "desc" },
  } satisfies Prisma.SearchQueryFindManyArgs;

  const countArgs = {
    where,
  } satisfies Prisma.SearchQueryCountArgs;

  const [searchQueries, total] = await Promise.all([
    db.searchQuery.findMany(findManyArgs),
    db.searchQuery.count(countArgs),
  ]);

  return {
    searchQueries,
    total,
    page,
    pageSize,
  };
};
