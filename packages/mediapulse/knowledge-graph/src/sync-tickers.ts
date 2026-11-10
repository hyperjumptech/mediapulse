import type { Prisma, prisma } from "@mediapulse/database";

import type { ListedCompany } from "./listed-companies";

export const TICKER_WRITE_CONCURRENCY = 10;

export type TickerSyncDb = {
  ticker: Pick<typeof prisma.ticker, "findMany" | "create" | "update">;
};

export type TickerSyncResult = {
  added: number;
  updated: number;
  unchanged: number;
  missingFromKnowledgeGraph: string[];
};

type TickerWrite = () => Promise<unknown>;

const normalizeSymbol = (symbol: string): string => symbol.trim().toUpperCase();

const runInBatches = async (
  writes: readonly TickerWrite[],
  batchSize: number,
): Promise<void> => {
  for (let start = 0; start < writes.length; start += batchSize) {
    const batch = writes.slice(start, start + batchSize);
    await Promise.all(batch.map((write) => write()));
  }
};

export const syncTickersFromKnowledgeGraph = async (
  companies: readonly ListedCompany[],
  db: TickerSyncDb,
): Promise<TickerSyncResult> => {
  const existingTickers = await db.ticker.findMany({
    select: { symbol: true, name: true },
  } satisfies Prisma.TickerFindManyArgs);
  const existingBySymbol = new Map(
    existingTickers.map((ticker) => [normalizeSymbol(ticker.symbol), ticker]),
  );
  const listedSymbols = new Set<string>();
  const writes: TickerWrite[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const company of companies) {
    const symbol = normalizeSymbol(company.symbol);
    if (symbol === "" || listedSymbols.has(symbol)) {
      continue;
    }
    listedSymbols.add(symbol);
    const existing = existingBySymbol.get(symbol);
    if (existing === undefined) {
      writes.push(() =>
        db.ticker.create({ data: { symbol, name: company.name } }),
      );
      added += 1;
      continue;
    }
    if (existing.name !== company.name) {
      writes.push(() =>
        db.ticker.update({
          where: { symbol: existing.symbol },
          data: { name: company.name },
        }),
      );
      updated += 1;
      continue;
    }
    unchanged += 1;
  }
  await runInBatches(writes, TICKER_WRITE_CONCURRENCY);
  const missingFromKnowledgeGraph = existingTickers
    .map((ticker) => ticker.symbol)
    .filter((symbol) => !listedSymbols.has(normalizeSymbol(symbol)))
    .sort();

  return { added, updated, unchanged, missingFromKnowledgeGraph };
};
