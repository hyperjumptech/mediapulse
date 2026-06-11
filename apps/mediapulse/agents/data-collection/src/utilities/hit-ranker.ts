import { extractHostname, reputationScore } from "./domain-reputation";
import type { WebSearchResult } from "./web-search";

const HOST_FATIGUE_THRESHOLD = 3;
const HOST_FATIGUE_PENALTY = 2;
const DOMAIN_TIER_WEIGHT = 4;
const MAX_SNIPPET_MATCH_SCORE = 3;

/**
 * Escapes user-provided alias text for safe use inside a RegExp.
 *
 * @param value - Raw alias string.
 */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Counts how many times an alias appears in a haystack with word-boundary safety.
 *
 * @param haystack - Lowercased title and snippet text.
 * @param alias - Alias token or phrase.
 */
const countAliasMatchesInHaystack = (
  haystack: string,
  alias: string,
): number => {
  const normalized = alias.trim().toLowerCase();
  if (normalized.length === 0) {
    return 0;
  }

  const tokens = haystack.split(/[^a-z0-9.]+/i).filter(Boolean);
  let tokenMatches = 0;
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === normalized || lower.startsWith(`${normalized}.`)) {
      tokenMatches += 1;
    }
  }
  if (tokenMatches > 0) {
    return tokenMatches;
  }

  const pattern = new RegExp(
    `(?<![a-z0-9.])${escapeRegExp(normalized)}(?![a-z0-9])`,
    "gi",
  );
  return [...haystack.matchAll(pattern)].length;
};

export type RankedHit = WebSearchResult & {
  score: number;
};

export type RankSearchHitsOptions = {
  tickerAliases: readonly string[];
  hostCounts: Record<string, number>;
};

/**
 * Counts distinct ticker alias matches inside a title and snippet.
 *
 * @param title - SERP title text.
 * @param snippet - SERP snippet text.
 * @param aliases - Lowercased ticker aliases.
 * @returns Match score capped at three to limit keyword-stuffing dominance.
 */
export const snippetMatchScore = (
  title: string,
  snippet: string,
  aliases: readonly string[],
): number => {
  const haystack = `${title}\n${snippet}`.toLowerCase();
  let matches = 0;
  for (const alias of aliases) {
    matches += countAliasMatchesInHaystack(haystack, alias);
  }
  return Math.min(matches, MAX_SNIPPET_MATCH_SCORE);
};

/**
 * Computes the pre-fetch ranking score for one search hit.
 *
 * @param hit - Search hit candidate.
 * @param options - Alias list and host-fatigue counts from the existing corpus.
 */
const computeHitScore = (
  hit: WebSearchResult,
  options: RankSearchHitsOptions,
): number => {
  const hostname = extractHostname(hit.url);
  const domainScore = reputationScore(hostname) * DOMAIN_TIER_WEIGHT;
  const snippetScore = snippetMatchScore(
    hit.title,
    hit.content,
    options.tickerAliases,
  );
  const serpBoost = 1 / (1 + hit.serpIndex);
  const hostCount = options.hostCounts[hostname] ?? 0;
  const noveltyPenalty =
    hostCount > HOST_FATIGUE_THRESHOLD ? HOST_FATIGUE_PENALTY : 0;

  return domainScore + snippetScore + serpBoost - noveltyPenalty;
};

/**
 * Ranks search hits by pre-fetch signal before Jina fetch spend.
 *
 * @param hits - Candidate hits that survived URL filtering.
 * @param options - Alias list and host-fatigue counts.
 * @returns Hits sorted by descending score with the score attached.
 */
export const rankSearchHits = (
  hits: readonly WebSearchResult[],
  options: RankSearchHitsOptions,
): RankedHit[] =>
  hits
    .map((hit) => ({
      ...hit,
      score: computeHitScore(hit, options),
    }))
    .sort((left, right) => right.score - left.score);
