import { prisma, type Prisma } from "@mediapulse/database";
import type {
  GetTickerRelevanceTermsResponse,
  TickerRelevanceTermsItem,
} from "@workspace/agent-data-api-contract";

import { parseProfileParties } from "./ticker-profile-parties.js";
import { defaultTickerProfileSource } from "./ticker-profile/ticker-profile-source-default.js";
import type {
  TickerProfileRecord,
  TickerProfileSource,
} from "./ticker-profile/ticker-profile-source.js";

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
  "dalam",
  "luar",
  "tetap",
  "hidup",
  "diri",
  "nasional",
  "internasional",
  "perusahaan",
  "khusus",
  "tempat",
  "swasta",
  "terintegrasi",
  "primer",
  "nonprimer",
  "pokok",
  "produktif",
  "menengah",
  "berlisensi",
  "karakter",
  "perindustrian",
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

const SECTOR_WIDE_WORDS = new Set([
  "anak",
  "investasi",
  "pembangunan",
  "pengembangan",
  "lahan",
  "jalur",
  "barang",
  "konsumen",
  "jaringan",
  "kapasitas",
  "merek",
  "platform",
  "distribusi",
  "komponen",
  "korporasi",
  "baku",
  "real",
  "estat",
  "mikro",
  "kalori",
  "termal",
  "keuangan",
  "digital",
  "teknologi",
  "infrastruktur",
  "media",
  "aplikasi",
  "data",
  "kereta",
  "kawasan",
  "industri",
  "gaya",
  "malam",
  "ruang",
  "operator",
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

export type TermBreadth = "broad" | "specific";

const isUsableWord = (word: string, breadth: TermBreadth): boolean => {
  const bare = bareWord(word);
  if (GENERIC_SEGMENT_WORDS.has(bare) || COMPOUND_ONLY_WORDS.has(bare)) {
    return false;
  }
  if (breadth === "specific" && SECTOR_WIDE_WORDS.has(bare)) {
    return false;
  }

  return bare.length >= MIN_WORD_CHARS || word === word.toUpperCase();
};

const isUsableTerm = (segment: string, breadth: TermBreadth): boolean => {
  const words = segment.split(/\s+/).filter((word) => word.length > 0);
  const onlyWord = words.length === 1 ? words[0] : undefined;

  return (
    isUsableSegment(segment) &&
    (onlyWord === undefined || isUsableWord(onlyWord, breadth))
  );
};

const appendTaxonomyTerm = (
  seen: Set<string>,
  terms: string[],
  value: string | null | undefined,
  breadth: TermBreadth,
): void => {
  if (typeof value !== "string") {
    return;
  }
  const label = value.trim();
  if (isUsableTerm(label, breadth)) {
    appendTerm(seen, terms, label);
  }
  for (const segment of taxonomyPhraseSegments(value, breadth)) {
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
export const taxonomyPhraseSegments = (
  label: string,
  breadth: TermBreadth = "broad",
): string[] => {
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
      if (isUsableTerm(segment, breadth)) {
        push(segment);
        if (current.length > 1) {
          for (const word of current) {
            if (isUsableWord(word, breadth)) {
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

export const buildTickerRelevanceTerms = (
  ticker: { id: string; symbol: string; name: string },
  profile: TickerProfileRecord | null,
): TickerRelevanceTermsItem => {
  const issuerSeen = new Set<string>();
  const issuerTerms: string[] = [];
  for (const name of [
    ticker.symbol,
    ticker.name,
    ...(profile?.aliases ?? []),
  ]) {
    appendTerm(issuerSeen, issuerTerms, name);
  }
  const competitorSeen = new Set(issuerSeen);
  const competitorTerms: string[] = [];
  const competitors =
    profile === null ? [] : parseProfileParties(profile.competitors);
  for (const competitor of competitors) {
    appendTerm(competitorSeen, competitorTerms, competitor.name);
    for (const alias of competitor.aliases) {
      if (alias.trim().length >= MIN_PEER_ALIAS_CHARS) {
        appendTerm(competitorSeen, competitorTerms, alias);
      }
    }
  }
  const taxonomy = [
    profile?.sectorIndonesian,
    profile?.subSectorIndonesian,
    profile?.industryIndonesian,
    profile?.subIndustryIndonesian,
  ];
  const seen = new Set(competitorSeen);
  const terms = [...issuerTerms, ...competitorTerms];
  const industrySeen = new Set(competitorSeen);
  const industryTerms: string[] = [];
  for (const label of taxonomy) {
    appendTaxonomyTerm(seen, terms, label, "broad");
    appendTaxonomyTerm(industrySeen, industryTerms, label, "specific");
  }

  return {
    id: ticker.id,
    symbol: ticker.symbol,
    terms,
    issuerTerms,
    competitorTerms,
    industryTerms,
  };
};

/**
 * Loads relevance-matching terms for every ticker that has an active search query set.
 *
 * @returns One entry per active ticker with its deduplicated relevance terms.
 */
type TickerRelevanceTermsDb = {
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "findMany">;
  ticker: Pick<typeof prisma.ticker, "findMany">;
};

export const getTickerRelevanceTermsForAgent = async (
  deps: {
    db?: TickerRelevanceTermsDb;
    profileSource?: TickerProfileSource;
  } = {},
): Promise<GetTickerRelevanceTermsResponse> => {
  const { db = prisma, profileSource = defaultTickerProfileSource } = deps;
  const activeSets = await db.searchQuerySet.findMany({
    where: { isActive: true },
    select: { tickerId: true },
  } satisfies Prisma.SearchQuerySetFindManyArgs);
  const activeTickerIds = [...new Set(activeSets.map((row) => row.tickerId))];

  if (activeTickerIds.length === 0) {
    return { tickers: [] };
  }

  const activeTickers = await db.ticker.findMany({
    where: { id: { in: activeTickerIds } },
    select: {
      id: true,
      symbol: true,
      name: true,
    },
    orderBy: { symbol: "asc" },
  } satisfies Prisma.TickerFindManyArgs);
  const profiles = await profileSource(
    activeTickers.map((ticker) => ticker.symbol),
  );

  const tickers = activeTickers.map((ticker) =>
    buildTickerRelevanceTerms(ticker, profiles.get(ticker.symbol) ?? null),
  );

  return { tickers };
};
