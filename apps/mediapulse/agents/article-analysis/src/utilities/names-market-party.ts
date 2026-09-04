import type { AnalysisTickerContext } from "@workspace/agent-data-api-contract";

const MIN_NAME_CHARS = 3;

/** Shortest distinctive token of a party name worth matching on its own. */
const MIN_TOKEN_CHARS = 4;

/**
 * Tokens that identify no company. A party name is matched on its leading distinctive token so
 * "Telkom Indonesia (Persero)" is found in a headline saying only "Telkom", and these are the words
 * that would otherwise make that match meaningless.
 */
const GENERIC_NAME_TOKENS: ReadonlySet<string> = new Set([
  "abadi",
  "agency",
  "authority",
  "bank",
  "central",
  "company",
  "control",
  "corporation",
  "development",
  "digital",
  "directorate",
  "energy",
  "estate",
  "exchange",
  "financial",
  "global",
  "group",
  "holding",
  "holdings",
  "indonesia",
  "indonesian",
  "industrial",
  "industri",
  "industry",
  "international",
  "investment",
  "kawasan",
  "kementerian",
  "ministry",
  "national",
  "nasional",
  "perusahaan",
  "persero",
  "product",
  "republic",
  "sector",
  "service",
  "services",
  "state",
  "tbk",
  "telecom",
  "telekomunikasi",
  // Indonesian words that are ordinary vocabulary as well as parts of company names. Without these
  // "Kopi Kenangan" is searched for as "Kopi" and matches any article mentioning coffee, and
  // "Bersama Mencapai Puncak" matches any article using "bersama" to mean "together".
  "aneka",
  "bersama",
  "bumi",
  "cipta",
  "jaya",
  "karya",
  "kopi",
  "makmur",
  "mitra",
  "prima",
  "puncak",
  "sejahtera",
  "sentosa",
  "sinar",
  "solusi",
  "sumber",
  "tunas",
  "utama",
]);

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Whether an alias is a ticker symbol or acronym rather than a word.
 *
 * Matched case-sensitively so `BEST`, the symbol for Bekasi Fajar Industrial Estate, does not match
 * the English word "best".
 */
const isSymbolLike = (alias: string): boolean =>
  /^[A-Z0-9]+$/u.test(alias) && alias.length <= 6;

const matches = (text: string, candidate: string): boolean => {
  const trimmed = candidate.trim();
  if (trimmed.length < MIN_NAME_CHARS) {
    return false;
  }
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`,
    isSymbolLike(trimmed) ? "u" : "iu",
  );

  return pattern.test(text);
};

/**
 * The strings that identify one party: its aliases, its full name, and its leading brand token.
 *
 * Only the leading distinctive token is used, never every token, so "Bekasi Fajar Industrial Estate"
 * is searched for as "Bekasi" and not also as "Fajar". A trailing token is where a generic word
 * usually sits, and matching on several tokens turns one name into several loose patterns.
 *
 * @param name - The party's registered name.
 * @param aliases - Its known aliases.
 */
const candidatesFor = (
  name: string,
  aliases: readonly string[],
): readonly string[] => {
  const candidates = [...aliases, name];
  const leading = name
    .split(/[^\p{L}\p{N}]+/u)
    .find(
      (token) =>
        token.length >= MIN_TOKEN_CHARS &&
        !GENERIC_NAME_TOKENS.has(token.toLowerCase()),
    );
  if (leading !== undefined) {
    candidates.push(leading);
  }

  return candidates;
};

/** A competitor or regulator the article names. */
export type MarketPartyMatch = {
  kind: "competitor" | "regulator";
  name: string;
};

/**
 * Finds a competitor or regulator from the issuer's stored profile that the article names.
 *
 * The gate prompt already says an article about a competitor qualifies "even when the issuer itself
 * is never mentioned", and that a regulator's rule "governs the conditions under which the issuer
 * operates". A small classifier does not apply either clause reliably: on 2026-09-04, eight articles
 * about one BPOM rule were judged for FORE, whose profile lists BPOM, and seven were rejected with a
 * note reasoning only about the issuer and its competitors. This answers the question in code so the
 * model is not asked to.
 *
 * - Important: this only lifts the issuer-relevance gate. The article must still win a section on
 *   that section's own qualifying rules, so a loose match here cannot ship an article by itself.
 *
 * @param text - The article's title and content.
 * @param ticker - Issuer context, or `null` when none was supplied.
 * @returns The party the article names, or `null` when it names none.
 */
export const textNamesMarketParty = (
  text: string,
  ticker: AnalysisTickerContext | null,
): MarketPartyMatch | null => {
  if (ticker === null || text.trim().length === 0) {
    return null;
  }

  for (const competitor of ticker.competitors) {
    for (const candidate of candidatesFor(
      competitor.name,
      competitor.aliases,
    )) {
      if (matches(text, candidate)) {
        return { kind: "competitor", name: competitor.name };
      }
    }
  }
  for (const regulator of ticker.regulators) {
    for (const candidate of candidatesFor(regulator.name, regulator.aliases)) {
      if (matches(text, candidate)) {
        return { kind: "regulator", name: regulator.name };
      }
    }
  }

  return null;
};
