import type { QueryAnalysisTickerProfile } from "@workspace/agent-data-api-contract";

import { HOME_MARKET, MARKET_ANCHORS } from "../constants";

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

export type TickerProfile = QueryAnalysisTickerProfile | null;

export type ProfileParty = { name: string; aliases: string[] };

export type Classification = {
  sector?: string;
  industry?: string;
  subSector?: string;
  subIndustry?: string;
  businessActivity?: string;
};

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

const assign = (
  classification: Classification,
  key: keyof Classification,
  value?: string | null,
): void => {
  const normalized = normalize(value);
  if (normalized !== undefined) {
    classification[key] = normalized;
  }
};

const fromTicker = (ticker: QueryAnalysisTicker): Classification => {
  const classification: Classification = {};
  assign(classification, "sector", ticker.sector);
  assign(classification, "industry", ticker.industry);
  assign(classification, "subSector", ticker.subSector);
  assign(classification, "subIndustry", ticker.subIndustry);
  assign(classification, "businessActivity", ticker.businessActivity);

  return classification;
};

export const deriveClassification = (
  ticker: QueryAnalysisTicker,
  profile: TickerProfile,
): Classification => {
  if (profile === null) {
    return fromTicker(ticker);
  }

  const classification: Classification = {};
  assign(classification, "sector", profile.sector.english);
  assign(classification, "industry", profile.industry.english);
  assign(classification, "subSector", profile.subSector.english);
  assign(classification, "subIndustry", profile.subIndustry.english);
  assign(classification, "businessActivity", profile.businessOperation);

  return classification;
};

export const deriveSearchClassification = (
  ticker: QueryAnalysisTicker,
  profile: TickerProfile,
): Classification => {
  if (profile === null) {
    return fromTicker(ticker);
  }

  const classification: Classification = {};
  assign(classification, "sector", profile.sector.indonesian);
  assign(classification, "industry", profile.industry.indonesian);
  assign(classification, "subSector", profile.subSector.indonesian);
  assign(classification, "subIndustry", profile.subIndustry.indonesian);

  return classification;
};

export const deriveMarketContext = (): MarketContext => ({
  homeMarket: HOME_MARKET,
  anchors: [...MARKET_ANCHORS],
});
