import type { TickerRelevanceTermsItem } from "@workspace/agent-data-api-contract";

/** Which tracked ticker a candidate matched, and on what term. */
export type TickerRelevanceMatch = {
  tickerId: string;
  tickerSymbol: string;
  term: string;
};

export type TickerRelevanceMatcher = {
  isEmpty: boolean;
  match: (text: string) => TickerRelevanceMatch | null;
};

type CompiledTerm = {
  tickerId: string;
  tickerSymbol: string;
  term: string;
  pattern: RegExp;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CONJUNCTION_ALTERNATION = "(?:&|dan|and)";

const NOMINALISING_CIRCUMFIXES: readonly { prefix: string; suffix: string }[] =
  [
    { prefix: "ke", suffix: "an" },
    { prefix: "per", suffix: "an" },
    { prefix: "pe", suffix: "an" },
  ];

/**
 * Shortest root worth matching once a nominalising circumfix is stripped.
 *
 * Keeps the derived root specific enough to stay on topic: `Kelistrikan` yields `listrik` and
 * `Perindustrian` yields `industri`, while `Keuangan` and `Perbankan` would yield `uang` and
 * `bank`, which are common enough to match most business copy on their own.
 */
const MIN_DERIVED_ROOT_CHARS = 5;

const derivedRoot = (word: string): string | null => {
  const lower = word.toLowerCase();
  const matched = NOMINALISING_CIRCUMFIXES.filter(
    ({ prefix, suffix }) => lower.startsWith(prefix) && lower.endsWith(suffix),
  );
  const longest = matched.reduce<
    (typeof NOMINALISING_CIRCUMFIXES)[number] | null
  >(
    (best, candidate) =>
      best === null || candidate.prefix.length > best.prefix.length
        ? candidate
        : best,
    null,
  );
  if (longest === null) {
    return null;
  }
  const root = lower.slice(
    longest.prefix.length,
    lower.length - longest.suffix.length,
  );

  return root.length >= MIN_DERIVED_ROOT_CHARS ? root : null;
};

const buildTermPattern = (term: string): RegExp | null => {
  const collapsed = term.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0) {
    return null;
  }

  const escaped = escapeRegExp(collapsed)
    .replace(/ /g, "\\s+")
    .replace(/\\s\+&\\s\+/g, `\\s+${CONJUNCTION_ALTERNATION}\\s+`);

  const root = collapsed.includes(" ") ? null : derivedRoot(collapsed);
  const body = root === null ? escaped : `(?:${escaped}|${escapeRegExp(root)})`;

  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "iu");
};

/**
 * Compiles a word-boundary matcher over every supplied ticker's relevance terms.
 *
 * - Important: terms include symbol, name, alias, peer, and sector/industry
 *   strings, so a match means the text is on-topic for the ticker, not
 *   necessarily about it.
 *
 * @param tickers - Tickers with their relevance terms.
 */
export function createTickerRelevanceMatcher(
  tickers: readonly TickerRelevanceTermsItem[],
): TickerRelevanceMatcher {
  const compiledTerms: CompiledTerm[] = [];

  for (const ticker of tickers) {
    const seenTerms = new Set<string>();
    for (const term of ticker.terms) {
      const normalizedTerm = term.trim().replace(/\s+/g, " ").toLowerCase();
      if (normalizedTerm.length === 0 || seenTerms.has(normalizedTerm)) {
        continue;
      }
      const pattern = buildTermPattern(term);
      if (!pattern) {
        continue;
      }
      seenTerms.add(normalizedTerm);
      compiledTerms.push({
        tickerId: ticker.id,
        tickerSymbol: ticker.symbol,
        term: term.trim().replace(/\s+/g, " "),
        pattern,
      });
    }
  }

  return {
    isEmpty: compiledTerms.length === 0,
    match: (text: string): TickerRelevanceMatch | null => {
      if (text.trim().length === 0) {
        return null;
      }

      for (const compiledTerm of compiledTerms) {
        if (compiledTerm.pattern.test(text)) {
          return {
            tickerId: compiledTerm.tickerId,
            tickerSymbol: compiledTerm.tickerSymbol,
            term: compiledTerm.term,
          };
        }
      }

      return null;
    },
  };
}

/**
 * Joins the free text available for a candidate at collection time.
 *
 * @param title - Candidate title, when discovery yielded one.
 * @param description - Candidate feed or meta description.
 */
export function buildRelevanceMatchText(
  title: string | undefined,
  description: string | undefined,
): string {
  return [title, description]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .trim();
}
