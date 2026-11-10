import type { Prisma, prisma } from "@mediapulse/database";

import type { ListedCompany } from "./listed-companies";

export const MAX_TICKER_REMOVALS_PER_SYNC = 25;

export type TickerSyncDb = {
  ticker: Pick<typeof prisma.ticker, "findMany" | "createMany" | "deleteMany">;
};

export type TickerSyncResult = {
  added: number;
  alreadyPresent: number;
  removed: string[];
  keptUnlisted: string[];
};

export class TickerRemovalLimitError extends Error {
  readonly symbols: string[];

  constructor(symbols: string[]) {
    super(
      `The knowledge graph no longer lists ${String(symbols.length)} tickers, more than the ${String(MAX_TICKER_REMOVALS_PER_SYNC)} one sync may remove. Nothing was changed.`,
    );
    this.symbols = symbols;
  }
}

const unreferencedTicker = {
  userTickers: { none: {} },
  newsletters: { none: {} },
  searchQueries: { none: {} },
  deliveryRuns: { none: {} },
  contentGenerationRuns: { none: {} },
  queryAnalysisRuns: { none: {} },
} as const satisfies Prisma.TickerWhereInput;

const normalizeSymbol = (symbol: string): string => symbol.trim().toUpperCase();

const sortedSymbols = (symbols: Iterable<string>): string[] =>
  [...symbols].sort();

export const syncTickersFromKnowledgeGraph = async (
  companies: readonly ListedCompany[],
  db: TickerSyncDb,
): Promise<TickerSyncResult> => {
  const existingTickers = await db.ticker.findMany({
    select: { symbol: true },
  } satisfies Prisma.TickerFindManyArgs);
  const existingSymbols = new Set(
    existingTickers.map((ticker) => normalizeSymbol(ticker.symbol)),
  );
  const listedSymbols = new Set<string>();
  const missingTickers: { symbol: string; name: string }[] = [];
  let alreadyPresent = 0;
  for (const company of companies) {
    const symbol = normalizeSymbol(company.symbol);
    if (symbol === "" || listedSymbols.has(symbol)) {
      continue;
    }
    listedSymbols.add(symbol);
    if (existingSymbols.has(symbol)) {
      alreadyPresent += 1;
      continue;
    }
    missingTickers.push({ symbol, name: company.name });
  }
  const unlistedSymbols = existingTickers
    .map((ticker) => ticker.symbol)
    .filter((symbol) => !listedSymbols.has(normalizeSymbol(symbol)));
  const removableTickers =
    unlistedSymbols.length === 0
      ? []
      : await db.ticker.findMany({
          where: { symbol: { in: unlistedSymbols }, ...unreferencedTicker },
          select: { symbol: true },
        } satisfies Prisma.TickerFindManyArgs);
  const removableSymbols = removableTickers.map((ticker) => ticker.symbol);
  if (removableSymbols.length > MAX_TICKER_REMOVALS_PER_SYNC) {
    throw new TickerRemovalLimitError(sortedSymbols(removableSymbols));
  }
  const created =
    missingTickers.length === 0
      ? { count: 0 }
      : await db.ticker.createMany({
          data: missingTickers,
          skipDuplicates: true,
        });
  if (removableSymbols.length > 0) {
    await db.ticker.deleteMany({
      where: { symbol: { in: removableSymbols }, ...unreferencedTicker },
    });
  }
  const removed = new Set(removableSymbols);

  return {
    added: created.count,
    alreadyPresent,
    removed: sortedSymbols(removed),
    keptUnlisted: sortedSymbols(
      unlistedSymbols.filter((symbol) => !removed.has(symbol)),
    ),
  };
};
