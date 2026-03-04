import { prisma } from "@workspace/database";
import type { IdxTickersPayload } from "./types";

/** Minimal DB type: only ticker.upsert is required (for DI and tests). */
export type TickerUpsertDb = {
  ticker: {
    upsert: (args: {
      where: { symbol: string };
      create: { symbol: string; name: string; metadata?: unknown };
      update: { name: string; metadata?: unknown };
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
 * upserts a ticker by symbol (create if missing, update if exists).
 *
 * @param payload - IDX API JSON object with `data` array of emiten rows.
 * @param db - Database client with ticker.upsert (default: production prisma).
 * @returns Count of rows processed (same as payload.data.length).
 */
export const importIdxTickers = async (
  payload: IdxTickersPayload,
  db: TickerUpsertDb = prisma as unknown as TickerUpsertDb,
): Promise<{ processed: number }> => {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  for (const row of rows) {
    const { symbol, name: tickerName, metadata } = mapIdxRowToTicker(row);
    if (!symbol) continue;
    await db.ticker.upsert({
      where: { symbol },
      create: { symbol, name: tickerName || symbol, metadata },
      update: { name: tickerName || symbol, metadata },
    });
  }
  return { processed: rows.length };
};
