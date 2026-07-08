import { HOME_MARKET, MARKET_ANCHORS } from "../constants";

/** Ticker classification fields surfaced by GET /query-analysis. */
export type QueryAnalysisTicker = {
  id: string;
  symbol: string;
  name: string;
  aliases?: string[];
  sector?: string | null;
  industry?: string | null;
  subSector?: string | null;
  subIndustry?: string | null;
  businessActivity?: string | null;
};

/** Normalized industry classification derived from the GET context ticker. */
export type Classification = {
  sector?: string;
  industry?: string;
  subSector?: string;
  subIndustry?: string;
  businessActivity?: string;
};

/** Home-market anchors used to geography-anchor discovery and industry queries. */
export type MarketContext = {
  homeMarket: string;
  anchors: string[];
};

const normalize = (value?: string | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Derives the normalized classification from a GET context ticker.
 *
 * @param ticker - Ticker fields from GET /query-analysis.
 * @returns Classification with empty/whitespace values dropped.
 */
export const deriveClassification = (
  ticker: QueryAnalysisTicker,
): Classification => {
  const classification: Classification = {};
  const sector = normalize(ticker.sector);
  const industry = normalize(ticker.industry);
  const subSector = normalize(ticker.subSector);
  const subIndustry = normalize(ticker.subIndustry);
  const businessActivity = normalize(ticker.businessActivity);
  if (sector !== undefined) {
    classification.sector = sector;
  }
  if (industry !== undefined) {
    classification.industry = industry;
  }
  if (subSector !== undefined) {
    classification.subSector = subSector;
  }
  if (subIndustry !== undefined) {
    classification.subIndustry = subIndustry;
  }
  if (businessActivity !== undefined) {
    classification.businessActivity = businessActivity;
  }

  return classification;
};

/** Returns the fixed Indonesian home-market anchors. */
export const deriveMarketContext = (): MarketContext => ({
  homeMarket: HOME_MARKET,
  anchors: [...MARKET_ANCHORS],
});
