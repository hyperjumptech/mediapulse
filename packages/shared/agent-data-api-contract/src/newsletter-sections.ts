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
  deals: "dealsAndMovements",
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
 * Sections that are intentionally excluded from the zero-coverage alert.
 *
 * `quickHits` is a catch-all populated at generation time from any homeless-intent
 * queries — it has no dedicated upstream search intent and is never expected to show
 * up with a positive count in {@link summarizeSectionCoverage}. Alerting on it would
 * produce a permanently firing false-positive.
 */
export const ZERO_COVERAGE_EXCLUDED_SECTIONS: ReadonlySet<NewsletterSectionId> =
  new Set<NewsletterSectionId>(["quickHits"]);

/**
 * Returns every section id that no intent maps to via {@link SECTION_BY_INTENT},
 * excluding sections in {@link ZERO_COVERAGE_EXCLUDED_SECTIONS} (catch-all sections
 * that are populated at generation time rather than by targeted search queries).
 */
export const sectionsWithoutDedicatedIntent = (): NewsletterSectionId[] => {
  const covered = new Set(
    Object.values(SECTION_BY_INTENT).filter(
      (sectionId): sectionId is NewsletterSectionId => sectionId !== null,
    ),
  );
  return NEWSLETTER_SECTION_IDS.filter(
    (sectionId) =>
      !covered.has(sectionId) &&
      !ZERO_COVERAGE_EXCLUDED_SECTIONS.has(sectionId),
  );
};

/**
 * Returns the newsletter section id that the given intent primarily feeds, or `null` when the
 * intent has no dedicated section (homeless intents flow to `industryPulse` or `quickHits`
 * at generation time).
 *
 * @param intent - A `QueryAnalysisIntent` value.
 * @returns The mapped `NewsletterSectionId`, or `null`.
 */
export const classifyQueryToSection = (
  intent: QueryAnalysisIntent,
): NewsletterSectionId | null => SECTION_BY_INTENT[intent];

/**
 * Summarises how many of the given intents map to each newsletter section.
 *
 * Always returns an entry for every `NewsletterSectionId` — sections with no matching queries
 * are present with `count: 0, share: 0`. `share` is the fraction of *classified* queries
 * (intents that map to a non-null section) claimed by each section, so shares sum to 1.0 over
 * sections with a positive count.
 *
 * @param intents - Array of `QueryAnalysisIntent` values (e.g. from a merged query set).
 * @returns Per-section `{ count, share }` record.
 */
export const summarizeSectionCoverage = (
  intents: QueryAnalysisIntent[],
): Record<NewsletterSectionId, { count: number; share: number }> => {
  const counts = Object.fromEntries(
    NEWSLETTER_SECTION_IDS.map((id) => [id, 0]),
  ) as Record<NewsletterSectionId, number>;

  for (const intent of intents) {
    const sectionId = SECTION_BY_INTENT[intent];
    if (sectionId !== null) {
      counts[sectionId] += 1;
    }
  }

  const classifiedCount = (Object.values(counts) as number[]).reduce(
    (sum, count) => sum + count,
    0,
  );

  return Object.fromEntries(
    NEWSLETTER_SECTION_IDS.map((id) => [
      id,
      {
        count: counts[id],
        share: classifiedCount > 0 ? counts[id] / classifiedCount : 0,
      },
    ]),
  ) as Record<NewsletterSectionId, { count: number; share: number }>;
};
