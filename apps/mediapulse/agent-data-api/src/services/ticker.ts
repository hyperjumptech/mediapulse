import { prisma, type Prisma } from "@mediapulse/database";
import type { GetTickerResponse } from "@workspace/agent-data-api-contract";

import {
  QUERY_ANALYSIS_PEER_LIMIT,
  buildPeerColumnFilters,
  extractTickerBusinessContext,
  extractTickerSectorIndustry,
  sortAndLimitPeers,
} from "./query-analysis-context-helpers";

/**
 * Loads one ticker row and normalizes alias metadata for agent consumers.
 *
 * @param tickerId - Primary key of the ticker row.
 * @returns Ticker identity payload, or `null` when the row is missing.
 */
export const getTickerForAgent = async (
  tickerId: string,
): Promise<GetTickerResponse | null> => {
  const row = await prisma.ticker.findUnique({
    where: { id: tickerId },
  });

  if (!row) {
    return null;
  }

  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const alias of row.aliases) {
    const trimmed = alias.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    aliases.push(trimmed);
  }

  const { sector, industry } = extractTickerSectorIndustry(row);
  const { subSector, subIndustry, businessActivity } =
    extractTickerBusinessContext(row);

  const peerFilters = buildPeerColumnFilters(sector, industry);
  const peerCandidates =
    peerFilters === undefined
      ? []
      : await prisma.ticker.findMany({
          where: {
            id: { not: row.id },
            OR: peerFilters,
          },
          select: { id: true, symbol: true, name: true, metadataRaw: true },
          take: QUERY_ANALYSIS_PEER_LIMIT * 4,
        } satisfies Prisma.TickerFindManyArgs);
  const peers = sortAndLimitPeers(peerCandidates).map((peer) => ({
    symbol: peer.symbol,
    name: peer.name,
  }));

  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    aliases,
    sector: sector ?? null,
    industry: industry ?? null,
    subSector: subSector ?? null,
    subIndustry: subIndustry ?? null,
    businessActivity: businessActivity ?? null,
    peers,
  };
};
