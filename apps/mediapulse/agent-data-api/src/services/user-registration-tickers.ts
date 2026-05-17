import type { Prisma } from "@mediapulse/database";
import { prisma } from "@mediapulse/database";

type TickerDelegate = Pick<typeof prisma.ticker, "findMany">;

const defaultTicker: TickerDelegate = prisma.ticker;

/**
 * Loads all tickers from the Mediapulse database for the registration ticker picker.
 * Ordered by symbol ascending.
 *
 * @param ticker - Injected `ticker` delegate for tests.
 * @returns Symbol and display name for each ticker row.
 */
export const listTickersForUserRegistration = async (
  ticker: TickerDelegate = defaultTicker,
): Promise<{ tickers: { symbol: string; name: string }[] }> => {
  const args = {
    select: { symbol: true, name: true },
    orderBy: { symbol: "asc" as const },
  } satisfies Prisma.TickerFindManyArgs;

  const rows = await ticker.findMany(args);

  return {
    tickers: rows.map((row) => ({
      symbol: row.symbol,
      name: row.name,
    })),
  };
};
