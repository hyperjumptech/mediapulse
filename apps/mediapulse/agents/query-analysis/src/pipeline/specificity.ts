/** Terms that tie a query to the issuer's market rather than to the whole web. */
const MARKET_TERMS = [
  "indonesia",
  "indonesian",
  "idx",
  "bei",
  "bursa",
  "saham",
  "emiten",
  "rupiah",
  "ojk",
  "jakarta",
] as const;

const MIN_ANCHOR_TOKEN_CHARS = 4;

/**
 * Tokens in a company name that identify no company on their own.
 *
 * "PT Mitra Adiperkasa Tbk" anchors on `mitra` and `adiperkasa`, and only the second is worth
 * matching: a query saying nothing but "mitra" is not about this issuer.
 */
const GENERIC_NAME_TOKENS: ReadonlySet<string> = new Set([
  "bank",
  "indonesia",
  "indonesian",
  "industri",
  "international",
  "mitra",
  "nasional",
  "persero",
  "tbk",
  "utama",
]);

const tokensOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);

/** Issuer context a query is judged against. */
export type QuerySubject = {
  symbol: string;
  name: string;
  aliases?: readonly string[];
  /** Sector, industry, and business-activity wording for this issuer. */
  sectorTerms?: readonly string[];
  /**
   * Competitor and regulator names from the issuer's profile.
   *
   * Without these a perfectly good competitor query reads as unanchored: for a BBRI set,
   * "Bank Mandiri" shares no token with the issuer's own name.
   */
  partyNames?: readonly string[];
};

const anchorTokensFor = (subject: QuerySubject): Set<string> => {
  const anchors = new Set<string>();
  for (const source of [
    subject.name,
    ...(subject.aliases ?? []),
    ...(subject.sectorTerms ?? []),
    ...(subject.partyNames ?? []),
  ]) {
    for (const token of tokensOf(source)) {
      if (
        token.length >= MIN_ANCHOR_TOKEN_CHARS &&
        !GENERIC_NAME_TOKENS.has(token)
      ) {
        anchors.add(token);
      }
    }
  }

  return anchors;
};

/**
 * Reports whether a query is too vague to be worth a search slot.
 *
 * Two shapes, both of which the generation prompt already forbids and the model still produces:
 *
 * A **bare ticker symbol**. The prompt's disambiguation rule says a symbol that is also a common
 * word "MUST include a disambiguator directly" in the query. `MAPI` shipped as an `industryPulse`
 * query anyway, and MAPI's reject pool on 2026-09-04 held "Nova Scotia Power changes back Lake
 * America on outage map", "Map Apps Are Handling Trump's Renaming of Lake Ontario", and "Cheshire
 * East to appoint partner to map out 'Greater Crewe' ambitions".
 *
 * A query **anchored to nothing**: no issuer name, no alias, no sector term, no market term. The
 * same set carried "Cultural Resurgence" and "Cultural Titans".
 *
 * - Important: intended for ordering, not removal, matching how perishable queries are handled. An
 *   intent whose candidates are all vague still fills its budget rather than shipping empty.
 *
 * @param text - The candidate query.
 * @param subject - The issuer the set is being built for.
 * @returns True when the query names nothing that ties it to this issuer's market.
 */
export const isVagueQuery = (text: string, subject: QuerySubject): boolean => {
  const tokens = tokensOf(text);
  if (tokens.length === 0) {
    return true;
  }

  const symbol = subject.symbol.toLowerCase();
  if (tokens.length === 1 && tokens[0] === symbol) {
    return true;
  }

  const anchors = anchorTokensFor(subject);

  return !tokens.some(
    (token) =>
      token === symbol ||
      anchors.has(token) ||
      MARKET_TERMS.includes(token as (typeof MARKET_TERMS)[number]),
  );
};
