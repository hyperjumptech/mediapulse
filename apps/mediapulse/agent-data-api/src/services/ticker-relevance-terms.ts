import { prisma, type Prisma } from "@mediapulse/database";
import type { GetTickerRelevanceTermsResponse } from "@workspace/agent-data-api-contract";

import {
  buildPeerColumnFilters,
  extractTickerBusinessContext,
  extractTickerSectorIndustry,
  sortAndLimitPeers,
} from "./query-analysis-context-helpers";

type PeerCandidate = {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  metadataRaw: Prisma.JsonValue;
};

const appendTerm = (
  seen: Set<string>,
  terms: string[],
  value: string | null | undefined,
): void => {
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (trimmed.length === 0 || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  terms.push(trimmed);
};

const indexPeerCandidatesByLabel = (
  candidates: PeerCandidate[],
): {
  bySector: Map<string, PeerCandidate[]>;
  byIndustry: Map<string, PeerCandidate[]>;
} => {
  const bySector = new Map<string, PeerCandidate[]>();
  const byIndustry = new Map<string, PeerCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.sector !== null) {
      const bucket = bySector.get(candidate.sector) ?? [];
      bucket.push(candidate);
      bySector.set(candidate.sector, bucket);
    }
    if (candidate.industry !== null) {
      const bucket = byIndustry.get(candidate.industry) ?? [];
      bucket.push(candidate);
      byIndustry.set(candidate.industry, bucket);
    }
  }

  return { bySector, byIndustry };
};

/**
 * Loads relevance-matching terms for every ticker that has an active search query set.
 *
 * @returns One entry per active ticker with its deduplicated relevance terms.
 */
export const getTickerRelevanceTermsForAgent =
  async (): Promise<GetTickerRelevanceTermsResponse> => {
    const activeSets = await prisma.searchQuerySet.findMany({
      where: { isActive: true },
      select: { tickerId: true },
    } satisfies Prisma.SearchQuerySetFindManyArgs);
    const activeTickerIds = [...new Set(activeSets.map((row) => row.tickerId))];

    if (activeTickerIds.length === 0) {
      return { tickers: [] };
    }

    const activeTickers = await prisma.ticker.findMany({
      where: { id: { in: activeTickerIds } },
      select: {
        id: true,
        symbol: true,
        name: true,
        aliases: true,
        sector: true,
        industry: true,
        subSector: true,
        subIndustry: true,
      },
      orderBy: { symbol: "asc" },
    } satisfies Prisma.TickerFindManyArgs);

    const peerFilters: Prisma.TickerWhereInput[] = [];
    const seenPeerFilters = new Set<string>();
    for (const ticker of activeTickers) {
      const { sector, industry } = extractTickerSectorIndustry(ticker);
      const filters = buildPeerColumnFilters(sector, industry) ?? [];
      for (const filter of filters) {
        const filterKey = JSON.stringify(filter);
        if (seenPeerFilters.has(filterKey)) {
          continue;
        }
        seenPeerFilters.add(filterKey);
        peerFilters.push(filter);
      }
    }

    const peerCandidates: PeerCandidate[] =
      peerFilters.length === 0
        ? []
        : await prisma.ticker.findMany({
            where: { OR: peerFilters },
            select: {
              id: true,
              symbol: true,
              name: true,
              sector: true,
              industry: true,
              metadataRaw: true,
            },
          } satisfies Prisma.TickerFindManyArgs);
    const { bySector, byIndustry } = indexPeerCandidatesByLabel(peerCandidates);

    const tickers = activeTickers.map((ticker) => {
      const { sector, industry } = extractTickerSectorIndustry(ticker);
      const { subSector, subIndustry } = extractTickerBusinessContext(ticker);

      const matchedPeers = new Map<string, PeerCandidate>();
      const sectorMatches =
        sector === undefined ? [] : (bySector.get(sector) ?? []);
      const industryMatches =
        industry === undefined ? [] : (byIndustry.get(industry) ?? []);
      for (const candidate of [...sectorMatches, ...industryMatches]) {
        if (candidate.id === ticker.id) {
          continue;
        }
        matchedPeers.set(candidate.id, candidate);
      }
      const peers = sortAndLimitPeers([...matchedPeers.values()]);

      const seen = new Set<string>();
      const terms: string[] = [];
      appendTerm(seen, terms, ticker.symbol);
      appendTerm(seen, terms, ticker.name);
      for (const alias of ticker.aliases) {
        appendTerm(seen, terms, alias);
      }
      for (const peer of peers) {
        appendTerm(seen, terms, peer.symbol);
        appendTerm(seen, terms, peer.name);
      }
      appendTerm(seen, terms, sector);
      appendTerm(seen, terms, industry);
      appendTerm(seen, terms, subSector);
      appendTerm(seen, terms, subIndustry);

      return { id: ticker.id, symbol: ticker.symbol, terms };
    });

    return { tickers };
  };
