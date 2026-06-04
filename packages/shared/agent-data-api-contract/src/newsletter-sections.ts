import type { QueryAnalysisIntent } from "./query-analysis.js";

/** Canonical newsletter sections in display order. */
export const MEDIAPULSE_NEWSLETTER_SECTIONS = [
  {
    id: "industryPulse",
    label: "Industry Pulse",
    description:
      "Lead prose section summarising the most significant macro or sector-wide development of the day.",
  },
  {
    id: "competitiveLandscape",
    label: "Competitive Landscape",
    description:
      "Bullets covering peer positioning, share shifts, and competitive threats relevant to the issuer.",
  },
  {
    id: "dealsAndMovements",
    label: "Deals & Movements",
    description:
      "Bullets covering M&A, funding rounds, leadership changes, and notable corporate actions.",
  },
  {
    id: "regulatoryPolicyWatch",
    label: "Regulatory & Policy Watch",
    description:
      "Bullets covering licensing, compliance, policy enforcement, and rulemaking that affects the issuer or its sector.",
  },
  {
    id: "disruptorsOrTech",
    label: "Disruptors / Tech",
    description:
      "Prose or bullets covering digital disruption, AI adoption, and technology shifts reshaping the sector.",
  },
  {
    id: "quickHits",
    label: "Quick Hits",
    description:
      "Short cited items that do not fit the main sections but are worth surfacing to the reader.",
  },
] as const;

export type NewsletterSectionId =
  (typeof MEDIAPULSE_NEWSLETTER_SECTIONS)[number]["id"];

/** Ordered list of all newsletter section ids — use this wherever a section list is needed. */
export const NEWSLETTER_SECTION_IDS: readonly NewsletterSectionId[] =
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => section.id);

/**
 * Maps every QueryAnalysisIntent to the newsletter section it primarily feeds.
 * `null` means the intent has no dedicated section and flows to industryPulse or quickHits at
 * generation time. This is the authoritative record of the current intent→section alignment.
 */
export const SECTION_BY_INTENT: Record<
  QueryAnalysisIntent,
  NewsletterSectionId | null
> = {
  competitor: "competitiveLandscape",
  regulatory: "regulatoryPolicyWatch",
  technology_trend: "disruptorsOrTech",
  technical: "disruptorsOrTech",
  industry_trend: "industryPulse",
  breaking: null,
  kg_change: null,
  fundamental: null,
  sentiment: null,
  supply_chain: null,
  esg: null,
  macro: null,
  geopolitical: null,
  wildcard: null,
};

/**
 * Returns every section id that no intent maps to via {@link SECTION_BY_INTENT}.
 * These are structurally required sections the upstream search pipeline does not cover by default —
 * e.g. `dealsAndMovements` has no dedicated intent and will be starved unless explicitly budgeted.
 */
export const sectionsWithoutDedicatedIntent = (): NewsletterSectionId[] => {
  const covered = new Set(
    Object.values(SECTION_BY_INTENT).filter(
      (sectionId): sectionId is NewsletterSectionId => sectionId !== null,
    ),
  );
  return NEWSLETTER_SECTION_IDS.filter((sectionId) => !covered.has(sectionId));
};
