export type RelevanceDropReason = "no_alias_match";

export type RelevanceDecision =
  | { relevant: true }
  | { relevant: false; reason: RelevanceDropReason };

export type RelevanceGateInput = {
  title: string;
  content: string;
  aliases: string[];
  /** Sector/industry labels that also satisfy the relevance gate when matched. */
  industryAliases?: string[];
};

export type RelevanceGateOptions = {
  headChars?: number;
  minMatches?: number;
};

const DEFAULT_HEAD_CHARS = 1500;
const DEFAULT_MIN_MATCHES = 1;

/**
 * Escapes user-provided alias text for safe use inside a RegExp.
 *
 * @param value - Raw alias string.
 */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns whether `alias` appears in `haystack` with word-boundary safety.
 *
 * @param haystack - Lowercased title + head content to search.
 * @param alias - Lowercased alias token or phrase.
 */
export const aliasMatchesHaystack = (
  haystack: string,
  alias: string,
): boolean => {
  const normalized = alias.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  const tokens = haystack.split(/[^a-z0-9.]+/i).filter(Boolean);
  if (tokens.some((token) => token.toLowerCase() === normalized)) {
    return true;
  }

  if (
    tokens.some((token) => token.toLowerCase().startsWith(`${normalized}.`))
  ) {
    return true;
  }

  const pattern = new RegExp(
    `(?<![a-z0-9.])${escapeRegExp(normalized)}(?![a-z0-9])`,
    "i",
  );
  return pattern.test(haystack);
};

/**
 * Builds the lowercased alias list used by {@link isRelevant}.
 *
 * @param symbol - Ticker symbol from agent-data-api.
 * @param name - Company name from agent-data-api.
 * @param aliases - Additional aliases from agent-data-api.
 */
export const buildTickerAliases = (
  symbol: string,
  name: string,
  aliases: readonly string[],
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of [symbol, name, ...aliases]) {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

/**
 * Builds sector/industry alias tokens for the relevance gate.
 *
 * @param sector - Sector label from ticker metadata, when present.
 * @param industry - Industry label from ticker metadata, when present.
 */
export const buildIndustryAliases = (
  sector: string | null | undefined,
  industry: string | null | undefined,
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of [sector, industry]) {
    if (value === null || value === undefined) {
      continue;
    }
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    if (trimmed.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

/**
 * Checks whether a fetched page mentions the target ticker or its sector/industry in the title or head content.
 *
 * @param input - Page title, body, company aliases, and optional industry aliases.
 * @param options - Scan window and minimum distinct alias matches required.
 * @returns Relevance decision for persistence gating.
 */
export const isRelevant = (
  input: RelevanceGateInput,
  options: RelevanceGateOptions = {},
): RelevanceDecision => {
  const headChars = options.headChars ?? DEFAULT_HEAD_CHARS;
  const minMatches = options.minMatches ?? DEFAULT_MIN_MATCHES;

  const normalizedAliases = [
    ...new Set(
      [...input.aliases, ...(input.industryAliases ?? [])]
        .map((alias) => alias.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  if (normalizedAliases.length === 0) {
    return { relevant: true };
  }

  const haystack =
    `${input.title}\n${input.content.slice(0, headChars)}`.toLowerCase();

  let distinctMatches = 0;
  for (const alias of normalizedAliases) {
    if (aliasMatchesHaystack(haystack, alias)) {
      distinctMatches += 1;
    }
  }

  if (distinctMatches >= minMatches) {
    return { relevant: true };
  }

  return { relevant: false, reason: "no_alias_match" };
};
