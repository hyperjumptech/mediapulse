import { prisma } from "@workspace/database";

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

/**
 * Fetches a paginated list of tickers ordered by symbol, optionally filtered by symbol or company name.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param options - Optional search term (partial match on symbol or name, case-insensitive).
 * @param db - Prisma client (injectable for tests).
 * @returns Tickers for the page plus total count and pagination info.
 */
export const getTickersPage = async (
  page: number,
  pageSize: number,
  options?: { search?: string },
  db: Db = prisma,
): Promise<TickersPageResult> => {
  const skip = (page - 1) * pageSize;
  const where = tickerSearchWhere(options?.search);
  const [tickers, total] = await Promise.all([
    db.ticker.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { symbol: "asc" },
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
