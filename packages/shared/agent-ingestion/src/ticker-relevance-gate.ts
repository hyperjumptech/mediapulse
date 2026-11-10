import type { TickerRelevanceTermsItem } from "@workspace/agent-data-api-contract";

/** Which tracked ticker a candidate matched, and on what term. */
export type TickerRelevanceMatch = {
  tickerId: string;
  tickerSymbol: string;
  term: string;
};

export type TickerRelevanceTermsInput = Pick<
  TickerRelevanceTermsItem,
  "id" | "symbol" | "terms"
> &
  Partial<
    Pick<
      TickerRelevanceTermsItem,
      "issuerTerms" | "competitorTerms" | "industryTerms"
    >
  >;

export type TickerRelevanceMatcher = {
  isEmpty: boolean;
  hasNamedTerms: boolean;
  match: (text: string) => TickerRelevanceMatch | null;
  matchAll: (text: string) => TickerRelevanceMatch[];
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

const isSymbolLike = (term: string): boolean =>
  /^[A-Z0-9]+$/.test(term) && term.length <= 6;

const buildTermPattern = (term: string): RegExp | null => {
  const collapsed = term.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0) {
    return null;
  }

  const escaped = escapeRegExp(collapsed)
    .replace(/ /g, "\\s+")
    .replace(/\\s\+&\\s\+/g, `\\s+${CONJUNCTION_ALTERNATION}\\s+`);

  const symbolLike = isSymbolLike(collapsed);
  const root =
    symbolLike || collapsed.includes(" ") ? null : derivedRoot(collapsed);
  const body = root === null ? escaped : `(?:${escaped}|${escapeRegExp(root)})`;
  const flags = symbolLike ? "u" : "iu";

  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags);
};

const compileTerms = (
  ticker: TickerRelevanceTermsInput,
  terms: readonly string[],
): CompiledTerm[] => {
  const seenTerms = new Set<string>();
  const compiled: CompiledTerm[] = [];
  for (const term of terms) {
    const normalizedTerm = term.trim().replace(/\s+/g, " ").toLowerCase();
    if (normalizedTerm.length === 0 || seenTerms.has(normalizedTerm)) {
      continue;
    }
    const pattern = buildTermPattern(term);
    if (!pattern) {
      continue;
    }
    seenTerms.add(normalizedTerm);
    compiled.push({
      tickerId: ticker.id,
      tickerSymbol: ticker.symbol,
      term: term.trim().replace(/\s+/g, " "),
      pattern,
    });
  }

  return compiled;
};

const toMatch = (compiledTerm: CompiledTerm): TickerRelevanceMatch => ({
  tickerId: compiledTerm.tickerId,
  tickerSymbol: compiledTerm.tickerSymbol,
  term: compiledTerm.term,
});

/**
 * Compiles a word-boundary matcher over every supplied ticker's relevance terms.
 *
 * - Important: terms include symbol, name, alias, peer, and sector/industry
 *   strings, so a match means the text is on-topic for the ticker, not
 *   necessarily about it.
 *
 * @param tickers - Tickers with their relevance terms.
 */
export const routingRelevanceTerms = (
  ticker: TickerRelevanceTermsInput,
): TickerRelevanceTermsInput => {
  const issuerTerms = ticker.issuerTerms ?? [];
  const competitorTerms = ticker.competitorTerms ?? [];
  if (issuerTerms.length === 0 && competitorTerms.length === 0) {
    return ticker;
  }

  return {
    ...ticker,
    terms: [
      ...issuerTerms,
      ...competitorTerms,
      ...(ticker.industryTerms ?? []),
    ],
  };
};

export function createTickerRelevanceMatcher(
  tickers: readonly TickerRelevanceTermsInput[],
): TickerRelevanceMatcher {
  const termsByTicker = tickers.map((ticker) =>
    compileTerms(ticker, ticker.terms),
  );
  const hasNamedTerms = tickers.some(
    (ticker) =>
      (ticker.issuerTerms ?? []).length > 0 ||
      (ticker.competitorTerms ?? []).length > 0,
  );

  return {
    isEmpty: termsByTicker.every((terms) => terms.length === 0),
    hasNamedTerms,
    match: (text: string): TickerRelevanceMatch | null => {
      if (text.trim().length === 0) {
        return null;
      }
      for (const terms of termsByTicker) {
        const matched = terms.find((compiledTerm) =>
          compiledTerm.pattern.test(text),
        );
        if (matched !== undefined) {
          return toMatch(matched);
        }
      }

      return null;
    },
    matchAll: (text: string): TickerRelevanceMatch[] => {
      if (text.trim().length === 0) {
        return [];
      }

      return termsByTicker.flatMap((terms) => {
        const matched = terms.find((compiledTerm) =>
          compiledTerm.pattern.test(text),
        );

        return matched === undefined ? [] : [toMatch(matched)];
      });
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
