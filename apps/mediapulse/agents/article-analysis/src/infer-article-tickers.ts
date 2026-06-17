/** Max article body characters scanned for ticker mentions (after title). */
export const INFER_ARTICLE_TICKERS_CONTENT_HEAD_CHARS = 4_000;

export type InferArticleTickerCandidate = {
  id: string;
  symbol: string;
  name: string;
  aliases: readonly string[];
};

export type InferredArticleTicker = {
  tickerId: string;
  reasoning: string;
  confidence: number;
};

export type InferArticleTickersFn = (
  article: { title: string; content: string },
  tickers: readonly InferArticleTickerCandidate[],
) => InferredArticleTicker[];

/**
 * Escapes user-provided text for safe use inside a RegExp.
 *
 * @param value - Raw string.
 */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns whether `needle` appears in `haystack` with word-boundary safety.
 *
 * @param haystack - Text to search.
 * @param needle - Token or phrase to find.
 */
const matchesWordBoundary = (haystack: string, needle: string): boolean => {
  const normalized = needle.trim();
  if (normalized.length === 0) {
    return false;
  }

  const pattern = new RegExp(
    `(?<![\\w$])${escapeRegExp(normalized)}(?![\\w$])`,
    "i",
  );
  return pattern.test(haystack);
};

type MatchKind = "symbol" | "name" | "alias";

/**
 * Maps a match kind and title presence to a heuristic confidence score.
 *
 * @param kind - Which ticker field matched.
 * @param inTitle - Whether the match occurred in the article title.
 */
const confidenceForMatch = (kind: MatchKind, inTitle: boolean): number => {
  if (kind === "symbol") {
    return inTitle ? 0.95 : 0.85;
  }
  if (kind === "name") {
    return inTitle ? 0.9 : 0.75;
  }
  return inTitle ? 0.8 : 0.65;
};

/**
 * Heuristic v1: matches ticker symbol, name, and aliases in the title and content head.
 *
 * @param article - Article title and full body (only the head is scanned).
 * @param tickers - Active tickers from analysis GET.
 * @returns Deduped matches sorted by confidence descending.
 */
export const inferArticleTickersHeuristic = (
  article: { title: string; content: string },
  tickers: readonly InferArticleTickerCandidate[],
): InferredArticleTicker[] => {
  const titleHaystack = article.title;
  const contentHead = article.content.slice(
    0,
    INFER_ARTICLE_TICKERS_CONTENT_HEAD_CHARS,
  );
  const bestByTickerId = new Map<string, InferredArticleTicker>();

  for (const ticker of tickers) {
    const candidates: Array<{
      kind: MatchKind;
      label: string;
      haystack: string;
    }> = [
      { kind: "symbol", label: ticker.symbol, haystack: titleHaystack },
      { kind: "name", label: ticker.name, haystack: titleHaystack },
      ...ticker.aliases.map((alias) => ({
        kind: "alias" as const,
        label: alias,
        haystack: titleHaystack,
      })),
      { kind: "symbol", label: ticker.symbol, haystack: contentHead },
      { kind: "name", label: ticker.name, haystack: contentHead },
      ...ticker.aliases.map((alias) => ({
        kind: "alias" as const,
        label: alias,
        haystack: contentHead,
      })),
    ];

    for (const candidate of candidates) {
      if (!matchesWordBoundary(candidate.haystack, candidate.label)) {
        continue;
      }

      const inTitle = candidate.haystack === titleHaystack;
      const confidence = confidenceForMatch(candidate.kind, inTitle);
      const reasoning =
        candidate.kind === "symbol"
          ? `Matched ticker symbol "${ticker.symbol}" in ${inTitle ? "title" : "content head"}`
          : candidate.kind === "name"
            ? `Matched company name "${ticker.name}" in ${inTitle ? "title" : "content head"}`
            : `Matched alias "${candidate.label}" in ${inTitle ? "title" : "content head"}`;

      const existing = bestByTickerId.get(ticker.id);
      if (existing !== undefined && existing.confidence >= confidence) {
        continue;
      }

      bestByTickerId.set(ticker.id, {
        tickerId: ticker.id,
        reasoning,
        confidence,
      });
    }
  }

  return [...bestByTickerId.values()].sort(
    (left, right) => right.confidence - left.confidence,
  );
};

/**
 * Infers which tickers an article relates to using heuristic token matching by default.
 *
 * @param article - Article title and body from the data source.
 * @param tickers - Active tickers (symbol, name, aliases) from analysis GET.
 * @param inferFn - Injectable matcher (defaults to {@link inferArticleTickersHeuristic}).
 * @returns Inferred ticker associations with reasoning and confidence.
 */
export const inferArticleTickers = (
  article: { title: string; content: string },
  tickers: readonly InferArticleTickerCandidate[],
  inferFn: InferArticleTickersFn = inferArticleTickersHeuristic,
): InferredArticleTicker[] => inferFn(article, tickers);
