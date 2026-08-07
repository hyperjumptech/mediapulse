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

export const titleNamesIssuer = (
  title: string,
  ticker: AnalysisTickerContext | null,
): boolean => {
  if (ticker === null || title.trim().length === 0) {
    return false;
  }

  const candidates = [ticker.symbol, ticker.name, ...ticker.aliases];

  return candidates.some((candidate) => matches(title, candidate));
};
