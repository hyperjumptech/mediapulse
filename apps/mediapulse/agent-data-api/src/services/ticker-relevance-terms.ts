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

/**
 * Shortest curated peer alias worth matching on. Aliases are hand-maintained per competitor, so
 * precision is a curation concern rather than a code one; this only keeps two-character fragments
 * such as "PT" or "AI" from matching half the corpus.
 */
const MIN_PEER_ALIAS_CHARS = 3;

type ProfileParty = { name: string; aliases: string[] };

const parseProfileParties = (value: unknown): ProfileParty[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const parties: ProfileParty[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as { name?: unknown; aliases?: unknown };
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
      continue;
    }
    const aliases = Array.isArray(candidate.aliases)
      ? candidate.aliases.filter(
          (alias): alias is string => typeof alias === "string",
        )
      : [];
    parties.push({ name: candidate.name, aliases });
  }

  return parties;
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
        profile: {
          select: {
            sectorIndonesian: true,
            subSectorIndonesian: true,
            industryIndonesian: true,
            subIndustryIndonesian: true,
            aliases: true,
            competitors: true,
          },
        },
      },
      orderBy: { symbol: "asc" },
    } satisfies Prisma.TickerFindManyArgs);

    const peerFilters: Prisma.TickerWhereInput[] = [];
    const seenPeerFilters = new Set<string>();
    for (const ticker of activeTickers) {
      if (ticker.profile != null) {
        continue;
      }
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
      const seen = new Set<string>();
      const terms: string[] = [];
      appendTerm(seen, terms, ticker.symbol);
      appendTerm(seen, terms, ticker.name);
      for (const alias of ticker.aliases) {
        appendTerm(seen, terms, alias);
      }

      const profile = ticker.profile ?? null;
      if (profile !== null) {
        for (const alias of profile.aliases) {
          appendTerm(seen, terms, alias);
        }
        for (const competitor of parseProfileParties(profile.competitors)) {
          appendTerm(seen, terms, competitor.name);
          for (const alias of competitor.aliases) {
            if (alias.trim().length >= MIN_PEER_ALIAS_CHARS) {
              appendTerm(seen, terms, alias);
            }
          }
        }
        appendTerm(seen, terms, profile.sectorIndonesian);
        appendTerm(seen, terms, profile.subSectorIndonesian);
        appendTerm(seen, terms, profile.industryIndonesian);
        appendTerm(seen, terms, profile.subIndustryIndonesian);

        // A profile describes the issuer in its own words ("Jaringan Kedai Kopi"), which reads well
        // to an analyst but rarely appears verbatim in news copy. The exchange taxonomy on the
        // ticker row uses the plain words reporters actually write ("Minuman"), so keep both:
        // curating a profile must only ever widen a ticker's reach, never narrow it.
        appendTerm(seen, terms, ticker.sector);
        appendTerm(seen, terms, ticker.subSector);
        appendTerm(seen, terms, ticker.industry);
        appendTerm(seen, terms, ticker.subIndustry);

        return { id: ticker.id, symbol: ticker.symbol, terms };
      }

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
