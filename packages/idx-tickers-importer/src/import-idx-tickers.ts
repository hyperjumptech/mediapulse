import { prisma } from "@workspace/database";
import type { IdxTickersPayload } from "./types";

/** Minimal DB type: ticker.findUnique, create, and update (for DI and tests). */
export type TickerUpsertDb = {
  ticker: {
    findUnique: (args: {
      where: { symbol: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: { symbol: string; name: string; metadata?: unknown };
    }) => Promise<{ id: string; symbol: string; name: string }>;
    update: (args: {
      where: { symbol: string };
      data: { name: string; metadata?: unknown };
    }) => Promise<{ id: string; symbol: string; name: string }>;
  };
};

/**
 * Maps an IDX emiten row to ticker create/update fields.
 * Uses KodeEmiten as symbol, NamaEmiten as name, and stores the full row as metadata.
 *
 * @param row - Single row from IDX API data array.
 * @returns Object suitable for Prisma ticker create/update.
 */
export const mapIdxRowToTicker = (
  row: IdxTickersPayload["data"][number],
): {
  symbol: string;
  name: string;
  metadata: unknown;
} => {
  const symbol = String(row.KodeEmiten ?? "").trim();
  const name = String(row.NamaEmiten ?? "").trim();
  const metadata = { ...row } as unknown;
  return { symbol, name, metadata };
};

/**
 * Imports IDX tickers payload into the database: for each item in `data`,
 * creates or updates a ticker by symbol and returns added/updated counts.
 *
 * @param payload - IDX API JSON object with `data` array of emiten rows.
 * @param db - Database client with ticker.findUnique, create, update (default: production prisma).
 * @returns Object with added and updated counts.
 */
export const importIdxTickers = async (
  payload: IdxTickersPayload,
  db: TickerUpsertDb = prisma as unknown as TickerUpsertDb,
): Promise<{ added: number; updated: number }> => {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  let added = 0;
  let updated = 0;
  for (const row of rows) {
    const { symbol, name: tickerName, metadata } = mapIdxRowToTicker(row);
    if (!symbol) continue;
    const existing = await db.ticker.findUnique({
      where: { symbol },
      select: { id: true },
    });
    if (existing) {
      await db.ticker.update({
        where: { symbol },
        data: { name: tickerName || symbol, metadata },
      });
      updated += 1;
    } else {
      await db.ticker.create({
        data: { symbol, name: tickerName || symbol, metadata },
      });
      added += 1;
    }
  }
  return { added, updated };
};
