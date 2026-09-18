/** One competitor or regulator carried by a Ticker Profile. */
export type MarketParty = {
  name: string;
  aliases: readonly string[];
};

/**
 * The part of an issuer's profile that names other parties.
 *
 * Structural on purpose: the agent-data-api contract's `AnalysisTickerContext` satisfies it, and
 * stating it here keeps this package free of a dependency on the contract.
 */
export type MarketPartyProfile = {
  competitors: readonly MarketParty[];
  regulators: readonly MarketParty[];
};

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
  /** The spelling the text used, which is rarely the party's registered name. */
  surfaceForm: string;
};

const firstNamedCandidate = (
  text: string,
  party: MarketParty,
): string | null => {
  for (const candidate of candidatesFor(party.name, party.aliases)) {
    if (matches(text, candidate)) {
      return candidate;
    }
  }

  return null;
};

/**
 * Finds every competitor and regulator from the issuer's stored profile that the article names.
 *
 * - Important: a party is reported once, under the first of its spellings that the text carries, so
 *   an article writing a company's name three ways yields one match and not three.
 *
 * @param text - The article's title and content.
 * @param ticker - Issuer context, or `null` when none was supplied.
 * @returns Every party the article names, competitors before regulators.
 */
export const textNamesMarketParties = (
  text: string,
  ticker: MarketPartyProfile | null,
): MarketPartyMatch[] => {
  if (ticker === null || text.trim().length === 0) {
    return [];
  }

  const found: MarketPartyMatch[] = [];
  const seen = new Set<string>();
  const collect = (
    parties: readonly MarketParty[],
    kind: MarketPartyMatch["kind"],
  ): void => {
    for (const party of parties) {
      if (seen.has(party.name)) {
        continue;
      }
      const surfaceForm = firstNamedCandidate(text, party);
      if (surfaceForm !== null) {
        seen.add(party.name);
        found.push({ kind, name: party.name, surfaceForm });
      }
    }
  };

  collect(ticker.competitors, "competitor");
  collect(ticker.regulators, "regulator");

  return found;
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
 * @returns The first party the article names, or `null` when it names none.
 */
export const textNamesMarketParty = (
  text: string,
  ticker: MarketPartyProfile | null,
): MarketPartyMatch | null => textNamesMarketParties(text, ticker)[0] ?? null;

/** Legal and corporate-form suffixes that say nothing about which company a name refers to. */
const LEGAL_FORM_TOKENS: ReadonlySet<string> = new Set([
  "bhd",
  "co",
  "corp",
  "corporation",
  "gmbh",
  "inc",
  "incorporated",
  "limited",
  "llc",
  "ltd",
  "persero",
  "plc",
  "pt",
  "pte",
  "sdn",
  "tbk",
]);

/**
 * Reduces a party or entity name to the form two spellings of one thing share.
 *
 * Case, diacritics, punctuation and legal form are all dropped, so "PT Fore Kopi Indonesia Tbk" and
 * "Fore Kopi Indonesia" normalise alike. This is what an emitted name is resolved against, and what
 * a stored entity is keyed on.
 *
 * @param name - A name as written.
 * @returns The normalised form, empty when the name carries nothing distinctive.
 */
export const normalizeEntityName = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0 && !LEGAL_FORM_TOKENS.has(token))
    .join(" ");

/**
 * Whether a name appears in a text as a whole word.
 *
 * - Important: this is the guard that keeps an extracted entity honest. A model may return a party
 *   the article only implies, and a name absent from the text is exactly that.
 *
 * @param text - The text to search.
 * @param name - The name to look for.
 */
export const textNamesEntity = (text: string, name: string): boolean =>
  matches(text, name.trim());
