import { prisma } from "@mediapulse/database";

type Db = typeof prisma;

export type TickersPageResult = {
  tickers: Awaited<ReturnType<Db["ticker"]["findMany"]>>;
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Builds a Prisma where clause for ticker search by symbol or name (partial, case-insensitive).
 *
 * @param search - Raw search string; trimmed and ignored if empty.
 * @returns Where clause object or undefined if no search.
 */
const tickerSearchWhere = (
  search: string | undefined,
):
  | {
      OR: Array<
        | { symbol: { contains: string; mode: "insensitive" } }
        | { name: { contains: string; mode: "insensitive" } }
      >;
    }
  | undefined => {
  const term = search?.trim();
  if (!term) return undefined;
  return {
    OR: [
      { symbol: { contains: term, mode: "insensitive" } },
      { name: { contains: term, mode: "insensitive" } },
    ],
  };
};

export type TickerSortField = "symbol" | "name" | "created";
export type TickerSortDir = "asc" | "desc";

const SORT_DEFAULT: { sortBy: TickerSortField; sortDir: TickerSortDir } = {
  sortBy: "symbol",
  sortDir: "asc",
};

/**
 * Builds Prisma orderBy from sort field and direction. "created" maps to createdAt.
 *
 * @param sortBy - Field to sort by (symbol, name, or created).
 * @param sortDir - asc or desc.
 * @returns Prisma orderBy object.
 */
const tickerOrderBy = (
  sortBy: TickerSortField,
  sortDir: TickerSortDir,
): {
  symbol?: "asc" | "desc";
  name?: "asc" | "desc";
  createdAt?: "asc" | "desc";
} => {
  const dir = sortDir === "asc" ? "asc" : "desc";
  if (sortBy === "created") return { createdAt: dir };
  if (sortBy === "name") return { name: dir };
  return { symbol: dir };
};

/**
 * Fetches a paginated list of tickers with optional sort and search.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term and sort (sortBy: symbol | name | created, sortDir: asc | desc).
 * @param db - Prisma client (injectable for tests).
 * @returns Tickers for the page plus total count and pagination info.
 */
export const getTickersPage = async (
  page: number,
  pageSize: number,
  options?: {
    search?: string;
    sortBy?: TickerSortField;
    sortDir?: TickerSortDir;
  },
  db: Db = prisma,
): Promise<TickersPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = tickerSearchWhere(options?.search);
  const sortBy = options?.sortBy ?? SORT_DEFAULT.sortBy;
  const sortDir = options?.sortDir ?? SORT_DEFAULT.sortDir;
  const orderBy = tickerOrderBy(sortBy, sortDir);

  const [tickers, total] = await Promise.all([
    db.ticker.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
    }),
    db.ticker.count({ where }),
  ]);
  return { tickers, total, page, pageSize };
};

/**
 * Fetches a single ticker by id, or null if not found.
 *
 * @param tickerId - UUID of the ticker.
 * @param db - Prisma client (injectable for tests).
 * @returns The ticker or null.
 */
export const getTickerById = async (
  tickerId: string,
  db: Db = prisma,
): Promise<Awaited<ReturnType<Db["ticker"]["findUnique"]>>> => {
  return db.ticker.findUnique({
    where: { id: tickerId },
  });
};
