import { prisma } from "@workspace/database";

type Db = typeof prisma;

export type TickersPageResult = {
  tickers: Awaited<ReturnType<Db["ticker"]["findMany"]>>;
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Fetches a paginated list of tickers ordered by symbol.
 *
 * @param page - 1-based page number.
 * @param pageSize - Number of items per page.
 * @param db - Prisma client (injectable for tests).
 * @returns Tickers for the page plus total count and pagination info.
 */
export const getTickersPage = async (
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<TickersPageResult> => {
  const skip = (page - 1) * pageSize;
  const [tickers, total] = await Promise.all([
    db.ticker.findMany({
      skip,
      take: pageSize,
      orderBy: { symbol: "asc" },
    }),
    db.ticker.count(),
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
