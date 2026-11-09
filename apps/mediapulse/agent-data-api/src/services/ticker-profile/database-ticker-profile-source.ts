import type { prisma } from "@mediapulse/database";

import {
  keyProfilesBySymbol,
  pickTickerProfiles,
  tickerProfileRecordSelect,
  type TickerProfileSource,
} from "./ticker-profile-source.js";

export type DatabaseTickerProfileDb = {
  tickerProfile: Pick<typeof prisma.tickerProfile, "findMany">;
};

export const createDatabaseTickerProfileSource =
  (db: DatabaseTickerProfileDb): TickerProfileSource =>
  async (symbols) => {
    const requested = [
      ...new Set(
        symbols
          .map((symbol) => symbol.trim())
          .filter((symbol) => symbol !== ""),
      ),
    ];
    if (requested.length === 0) {
      return new Map();
    }
    const rows = await db.tickerProfile.findMany({
      where: { ticker: { symbol: { in: requested } } },
      select: {
        ...tickerProfileRecordSelect,
        ticker: { select: { symbol: true } },
      },
    });
    const keyed = keyProfilesBySymbol(
      rows.map(({ ticker, ...profile }) => [ticker.symbol, profile]),
    );

    return pickTickerProfiles(keyed, symbols);
  };
