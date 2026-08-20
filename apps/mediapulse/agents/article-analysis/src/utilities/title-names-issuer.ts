import type { AnalysisTickerContext } from "@workspace/agent-data-api-contract";

const MIN_ALIAS_CHARS = 3;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isSymbolLike = (alias: string): boolean =>
  /^[A-Z0-9]+$/.test(alias) && alias.length <= 6;

const matches = (title: string, alias: string): boolean => {
  const trimmed = alias.trim();
  if (trimmed.length < MIN_ALIAS_CHARS) {
    return false;
  }
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`,
    isSymbolLike(trimmed) ? "u" : "iu",
  );

  return pattern.test(title);
};

/**
 * Whether any text names the issuer by symbol, registered name, or alias.
 *
 * - Important: a bare symbol match is deliberate, so a foreign company sharing the symbol reads as
 *   issuer coverage here. Callers that cannot tolerate that must rule out a homonym separately.
 *
 * @param text - Text to search.
 * @param ticker - Issuer context, or `null` when none was supplied.
 */
export const textNamesIssuer = (
  text: string,
  ticker: AnalysisTickerContext | null,
): boolean => {
  if (ticker === null || text.trim().length === 0) {
    return false;
  }

  const candidates = [ticker.symbol, ticker.name, ...ticker.aliases];

  return candidates.some((candidate) => matches(text, candidate));
};

export const titleNamesIssuer = (
  title: string,
  ticker: AnalysisTickerContext | null,
): boolean => textNamesIssuer(title, ticker);
