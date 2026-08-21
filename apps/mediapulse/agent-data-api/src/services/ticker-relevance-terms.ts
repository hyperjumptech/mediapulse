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

/**
 * Words that join the parts of a descriptive taxonomy label rather than naming a business.
 */
const PHRASE_CONNECTORS = new Set([
  "dengan",
  "dan",
  "untuk",
  "berbasis",
  "serta",
  "atau",
  "pada",
  "yang",
  "melalui",
  "dari",
  "di",
  "ke",
  "and",
  "with",
  "for",
]);

/**
 * Segments that name no business on their own, so indexing them would match unrelated copy.
 */
const GENERIC_SEGMENT_WORDS = new Set([
  "sendiri",
  "lain",
  "lainnya",
  "besar",
  "kecil",
  "baru",
  "utama",
  "umum",
  "milik",
  "negara",
  "format",
  "kontrak",
  "regional",
  "terafiliasi",
  "fokus",
  "grup",
  "tier",
  "iv",
  "multi",
  "produksi",
  "jasa",
  "layanan",
  "penjualan",
  "pengelolaan",
  "kepemilikan",
  "operasi",
  "penyedia",
  "produk",
]);

/**
 * Words that carry meaning only inside their compound. `Batu Bara` is coal; `Batu` is a stone and
 * `Bara` is an ember, so neither belongs in the index on its own. Applied to word-level emission
 * only, so the compound segment itself is unaffected.
 */
const COMPOUND_ONLY_WORDS = new Set([
  "batu",
  "bara",
  "kedai",
  "serat",
  "alas",
  "kaki",
  "rumah",
  "pusat",
  "gerai",
]);

const MIN_SEGMENT_CHARS = 3;

/**
 * Shortest single word worth indexing on its own.
 *
 * A three-letter fragment matches too much Indonesian copy; four keeps `Emas`, `Kopi` and `Bank`
 * while dropping the connective debris a split leaves behind.
 */
const MIN_WORD_CHARS = 4;

const bareWord = (word: string): string =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const isUsableSegment = (segment: string): boolean => {
  const words = segment.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0 || segment.length < 2) {
    return false;
  }
  if (segment.length < MIN_SEGMENT_CHARS && segment !== segment.toUpperCase()) {
    return false;
  }

  return !words.every((word) => GENERIC_SEGMENT_WORDS.has(bareWord(word)));
};

const isUsableWord = (word: string): boolean => {
  const bare = bareWord(word);
  if (GENERIC_SEGMENT_WORDS.has(bare) || COMPOUND_ONLY_WORDS.has(bare)) {
    return false;
  }

  return bare.length >= MIN_WORD_CHARS || word === word.toUpperCase();
};

const appendTaxonomyTerm = (
  seen: Set<string>,
  terms: string[],
  value: string | null | undefined,
): void => {
  appendTerm(seen, terms, value);
  if (typeof value !== "string") {
    return;
  }
  for (const segment of taxonomyPhraseSegments(value)) {
    appendTerm(seen, terms, segment);
  }
};

/**
 * Splits a descriptive taxonomy label into the business terms it names.
 *
 * Exchange and profile taxonomy labels are written as prose, so the whole string almost never
 * appears in news copy. INDY's `Batu Bara dengan Diversifikasi Emas dan EV` and FORE's
 * `Kedai Kopi Berbasis Aplikasi dan Pengantaran` match nothing as written, which hides the
 * issuer's other business lines from the collection gate entirely.
 *
 * Both the connector-delimited segments and their individual words are returned, because the
 * segment alone is often still prose: `Diversifikasi Emas` is as unmatchable as the full label,
 * while `Emas` is the word a gold story actually uses.
 *
 * - Important: this widens the collection gate by design. The gate decides only what is stored;
 *   article-analysis still judges every stored article against the issuer.
 *
 * @param label - A taxonomy label, which may be a single term or a descriptive phrase.
 * @returns The label's business segments and their indexable words, connectors removed.
 */
export const taxonomyPhraseSegments = (label: string): string[] => {
  const found: string[] = [];
  const push = (value: string): void => {
    if (!found.includes(value)) {
      found.push(value);
    }
  };

  for (const chunk of label.split(/[,;/()]|\s+-\s+/)) {
    let current: string[] = [];
    const flush = (): void => {
      if (current.length === 0) {
        return;
      }
      const segment = current.join(" ").trim();
      if (isUsableSegment(segment)) {
        push(segment);
        if (current.length > 1) {
          for (const word of current) {
            if (isUsableWord(word)) {
              push(word);
            }
          }
        }
      }
      current = [];
    };
    for (const word of chunk.split(/\s+/)) {
      if (bareWord(word).length === 0) {
        continue;
      }
      if (PHRASE_CONNECTORS.has(bareWord(word))) {
        flush();
        continue;
      }
      current.push(word);
    }
    flush();
  }

  return found;
};

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
        appendTaxonomyTerm(seen, terms, profile.sectorIndonesian);
        appendTaxonomyTerm(seen, terms, profile.subSectorIndonesian);
        appendTaxonomyTerm(seen, terms, profile.industryIndonesian);
        appendTaxonomyTerm(seen, terms, profile.subIndustryIndonesian);

        // A profile describes the issuer in its own words ("Jaringan Kedai Kopi"), which reads well
        // to an analyst but rarely appears verbatim in news copy. The exchange taxonomy on the
        // ticker row uses the plain words reporters actually write ("Minuman"), so keep both:
        // curating a profile must only ever widen a ticker's reach, never narrow it.
        appendTaxonomyTerm(seen, terms, ticker.sector);
        appendTaxonomyTerm(seen, terms, ticker.subSector);
        appendTaxonomyTerm(seen, terms, ticker.industry);
        appendTaxonomyTerm(seen, terms, ticker.subIndustry);

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
      appendTaxonomyTerm(seen, terms, sector);
      appendTaxonomyTerm(seen, terms, industry);
      appendTaxonomyTerm(seen, terms, subSector);
      appendTaxonomyTerm(seen, terms, subIndustry);

      return { id: ticker.id, symbol: ticker.symbol, terms };
    });

    return { tickers };
  };
