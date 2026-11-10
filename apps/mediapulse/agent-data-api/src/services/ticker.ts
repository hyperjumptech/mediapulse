import { prisma, type Prisma } from "@mediapulse/database";
import type { GetTickerResponse } from "@workspace/agent-data-api-contract";

import { tickerFieldsFromProfile } from "./ticker-fields-from-profile.js";
import { defaultTickerProfileSource } from "./ticker-profile/ticker-profile-source-default.js";
import type { TickerProfileSource } from "./ticker-profile/ticker-profile-source.js";

type TickerDb = {
  ticker: Pick<typeof prisma.ticker, "findUnique">;
};

export const getTickerForAgent = async (
  tickerId: string,
  db: TickerDb = prisma,
  profileSource: TickerProfileSource = defaultTickerProfileSource,
): Promise<GetTickerResponse | null> => {
  const row = await db.ticker.findUnique({
    where: { id: tickerId },
    select: { id: true, symbol: true, name: true },
  } satisfies Prisma.TickerFindUniqueArgs);

  if (!row) {
    return null;
  }

  const profiles = await profileSource([row.symbol]);
  const profile = profiles.get(row.symbol) ?? null;

  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    ...tickerFieldsFromProfile(profile),
    peers: [],
  };
};
