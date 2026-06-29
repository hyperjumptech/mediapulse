import { prisma, type Prisma } from "@mediapulse/database";
import type { GetTickerResponse } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import {
  QUERY_ANALYSIS_PEER_LIMIT,
  buildPeerMetadataOrFilters,
  extractTickerBusinessContext,
  extractTickerSectorIndustry,
  sortAndLimitPeers,
} from "./query-analysis-context-helpers";

const tickerMetadataSchema = z
  .object({
    aliases: z.array(z.string()).optional(),
  })
  .passthrough();

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

  const metadata = tickerMetadataSchema.safeParse(row.metadata);
  const storedAliases =
    metadata.success && Array.isArray(metadata.data.aliases)
      ? metadata.data.aliases
      : [];

  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const alias of storedAliases) {
    const trimmed = alias.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    aliases.push(trimmed);
  }

  const { sector, industry } = extractTickerSectorIndustry(row.metadata);
  const { subSector, subIndustry, businessActivity } =
    extractTickerBusinessContext(row.metadata);

  const peerFilters = buildPeerMetadataOrFilters(sector, industry);
  const peerCandidates =
    peerFilters === undefined
      ? []
      : await prisma.ticker.findMany({
          where: {
            id: { not: row.id },
            OR: peerFilters,
          },
          select: { id: true, symbol: true, name: true, metadata: true },
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
