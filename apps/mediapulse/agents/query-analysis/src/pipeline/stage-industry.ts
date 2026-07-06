import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

import { bestIndustryLabel, type Classification } from "./context";
import type { MarketContext } from "./context";
import type { Candidate, Language } from "./types";

/** A theme template resolved into one query text per language. */
type ThemeTemplate = {
  intent: QueryAnalysisIntent;
  id: (label: string) => string;
  en: (label: string) => string;
};

/**
 * Industry/tech/macro theme templates plus a small wildcard slice. Each resolves
 * the best available classification label and is anchored to the home market by
 * the caller.
 */
const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    intent: "industry_trend",
    id: (label) => `industri ${label}`,
    en: (label) => `${label} industry`,
  },
  {
    intent: "industry_trend",
    id: (label) => `prospek ${label}`,
    en: (label) => `${label} outlook`,
  },
  {
    intent: "technology_trend",
    id: (label) => `teknologi ${label}`,
    en: (label) => `${label} technology disruption`,
  },
  {
    intent: "macro",
    id: (label) => `ekonomi ${label}`,
    en: (label) => `${label} economy`,
  },
  {
    intent: "wildcard",
    id: (label) => `tren baru ${label}`,
    en: (label) => `emerging ${label} trends`,
  },
];

/**
 * Builds industry-context candidates: industry/tech/macro themes plus a wildcard
 * slice, each anchored to the home market, per language.
 *
 * @param classification - Normalized ticker classification.
 * @param market - Home-market anchors.
 * @param languages - Languages to emit candidates for.
 * @returns LLM-sourced industry candidates.
 */
export const buildIndustryCandidates = (
  classification: Classification,
  market: MarketContext,
  languages: readonly Language[],
): Candidate[] => {
  const label = bestIndustryLabel(classification) ?? market.homeMarket;
  const anchor = market.anchors[0] ?? market.homeMarket;
  const candidates: Candidate[] = [];

  for (const language of languages) {
    for (const template of THEME_TEMPLATES) {
      const theme = language === "id" ? template.id(label) : template.en(label);
      candidates.push({
        text: `${theme} ${anchor}`,
        intent: template.intent,
        source: "llm",
        language,
      });
    }
  }

  return candidates;
};
