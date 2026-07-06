import { prisma } from "@mediapulse/database";
import type { IdxTickersPayload } from "./types";

/** Structured ticker fields mapped from an IDX emiten row. */
export type MappedTickerFields = {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  subSector: string | null;
  subIndustry: string | null;
  businessActivity: string | null;
  aliases: string[];
  metadataRaw: unknown;
};

/** Ticker create payload derived from {@link MappedTickerFields} (drops `symbol`). */
type TickerCreateData = { symbol: string; name: string } & Omit<
  MappedTickerFields,
  "symbol"
>;

/** Ticker update payload derived from {@link MappedTickerFields} (drops `symbol`). */
type TickerUpdateData = Omit<MappedTickerFields, "symbol">;

/** Minimal DB type: ticker.findUnique, create, and update (for DI and tests). */
export type TickerUpsertDb = {
  ticker: {
    findUnique: (args: {
      where: { symbol: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: TickerCreateData;
    }) => Promise<{ id: string; symbol: string; name: string }>;
    update: (args: {
      where: { symbol: string };
      data: TickerUpdateData;
    }) => Promise<{ id: string; symbol: string; name: string }>;
  };
};

/** Trims a nullable IDX string field to a non-empty value, or `null`. */
const normalizeField = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Maps an IDX emiten row to structured ticker create/update fields.
 * Uses KodeEmiten as symbol, NamaEmiten as name, promotes the classification
 * columns from the Indonesian keys, and keeps the full row on `metadataRaw`.
 *
 * @param row - Single row from IDX API data array.
 * @returns Object suitable for Prisma ticker create/update.
 */
export const mapIdxRowToTicker = (
  row: IdxTickersPayload["data"][number],
): MappedTickerFields => {
  const symbol = String(row.KodeEmiten ?? "").trim();
  const name = String(row.NamaEmiten ?? "").trim();
  const metadataRaw = { ...row } as unknown;

  return {
    symbol,
    name,
    sector: normalizeField(row.Sektor),
    industry: normalizeField(row.Industri),
    subSector: normalizeField(row.SubSektor),
    subIndustry: normalizeField(row.SubIndustri),
    businessActivity: normalizeField(row.KegiatanUsahaUtama),
    aliases: [],
    metadataRaw,
  };
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
    const {
      symbol,
      name: tickerName,
      ...classification
    } = mapIdxRowToTicker(row);
    if (!symbol) continue;
    const existing = await db.ticker.findUnique({
      where: { symbol },
      select: { id: true },
    });
    if (existing) {
      await db.ticker.update({
        where: { symbol },
        data: { name: tickerName || symbol, ...classification },
      });
      updated += 1;
    } else {
      await db.ticker.create({
        data: { symbol, name: tickerName || symbol, ...classification },
      });
      added += 1;
    }
  }
  return { added, updated };
};
