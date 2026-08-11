import type { AnalysisTickerContext } from "@workspace/agent-data-api-contract";

const MIN_SYMBOL_CHARS = 3;

const MAX_SYMBOL_CHARS = 6;

/**
 * Exchange codes that are not the issuer's. IDX, JK, JKSE and BEI are deliberately absent: a
 * headline writing `IDX: CCSI` is the issuer, not a homonym.
 */
const FOREIGN_EXCHANGES = [
  "NASDAQ",
  "NYSE",
  "NYSEAMERICAN",
  "AMEX",
  "OTC",
  "OTCMKTS",
  "OTCQB",
  "OTCQX",
  "LSE",
  "LON",
  "TSX",
  "TSXV",
  "ASX",
  "SGX",
  "HKEX",
  "SEHK",
  "KLSE",
  "BURSA",
  "SET",
  "PSE",
  "BSE",
  "NSE",
  "TYO",
  "KRX",
  "SHE",
  "SSE",
  "FRA",
  "ETR",
  "EPA",
  "BIT",
  "BME",
  "SWX",
  "STO",
  "CPH",
  "OSL",
  "TASE",
  "TADAWUL",
  "ADX",
  "DFM",
  "QSE",
  "EGX",
  "JSE",
  "NZX",
  "BMV",
  "B3",
];

/**
 * Corporate designators that no IDX issuer carries. An Indonesian issuer is `PT … Tbk`, so a
 * `Name (SYM)` binding ending in one of these names some other company.
 */
const FOREIGN_CORPORATE_SUFFIXES = [
  "Inc",
  "Corp",
  "Corporation",
  "Company",
  "Co",
  "Ltd",
  "Limited",
  "LLC",
  "LP",
  "PLC",
  "AG",
  "SE",
  "NV",
  "N\\.V",
  "SA",
  "S\\.A",
  "AB",
  "AS",
  "Oyj",
  "Holdings",
  "Group",
];

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isIdxSymbol = (symbol: string): boolean =>
  new RegExp(`^[A-Z]{${MIN_SYMBOL_CHARS},${MAX_SYMBOL_CHARS}}$`).test(symbol);

const exchangeQualified = (text: string, symbol: string): boolean =>
  new RegExp(
    `\\b(?:${FOREIGN_EXCHANGES.join("|")})\\s*[:.]\\s*${escapeRegExp(symbol)}\\b`,
    "i",
  ).test(text);

const boundToForeignCompany = (text: string, symbol: string): boolean =>
  new RegExp(
    `\\b(?:${FOREIGN_CORPORATE_SUFFIXES.join("|")})\\.?,?\\s*\\(\\s*(?:[A-Z]{2,12}\\s*[:.]\\s*)?${escapeRegExp(symbol)}\\s*\\)`,
    "i",
  ).test(text);

/**
 * Reports whether the text binds the issuer's ticker symbol to a different company.
 *
 * IDX symbols collide with symbols on other exchanges, and a bare symbol match is enough to make
 * {@link titleNamesIssuer} treat a foreign homonym as issuer coverage. Two independent bindings
 * count, both requiring the symbol itself to be present:
 *
 * 1. The symbol is qualified by a non-Indonesian exchange, as in `Consensus Cloud (NASDAQ: CCSI)`.
 * 2. The symbol is bound to a name carrying a corporate designator no IDX issuer uses, as in
 *    `Consensus Cloud Solutions Inc. (CCSI)`.
 *
 * - Important: A `Name (SYM)` binding alone is not enough. Indonesian coverage routinely writes
 *   `PT Communication Cable Systems Indonesia Tbk (CCSI)`, so the designator or the exchange has to
 *   be foreign before the symbol is read as somebody else's.
 *
 * @param text - Title, description and body concatenated.
 * @param ticker - Issuer context; a null ticker can have no collision.
 * @returns True when the symbol in this text belongs to a different issuer.
 */
export const namesForeignSymbolHomonym = (
  text: string,
  ticker: AnalysisTickerContext | null,
): boolean => {
  if (ticker === null || text.trim().length === 0) {
    return false;
  }
  const symbol = ticker.symbol.trim().toUpperCase();
  if (!isIdxSymbol(symbol)) {
    return false;
  }

  return exchangeQualified(text, symbol) || boundToForeignCompany(text, symbol);
};
