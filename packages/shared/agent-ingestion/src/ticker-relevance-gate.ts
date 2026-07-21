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

const buildTermPattern = (term: string): RegExp | null => {
  const collapsed = term.trim().replace(/\s+/g, " ");
  if (collapsed.length === 0) {
    return null;
  }

  const escaped = escapeRegExp(collapsed).replace(/ /g, "\\s+");

  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
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
