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
    id: "issuerPerformance",
    label: "Issuer Performance",
    description:
      "Bullets covering the issuer's own reported results: revenue, profit, margin, volume, guidance, and payout decisions.",
  },
  {
    id: "issuerNews",
    label: "Issuer News",
    description:
      "Bullets covering material developments at the issuer that are not reported results: share and index moves, regulatory or legal action against it, capex and guidance commentary, and its own launches and partnerships.",
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
 * Sections ordered most specific first, used to choose between sections an article qualifies for.
 *
 * This is deliberately not display order. `industryPulse` and `quickHits` are catch-alls: an article
 * that also qualifies as a peer move, a corporate action, a regulatory action, or a technology
 * deployment belongs in that narrower section, and should only fall through to a catch-all when
 * nothing narrower fits. Display order stays {@link MEDIAPULSE_NEWSLETTER_SECTIONS}, which drives
 * the newsletter's layout and must not change when routing changes.
 *
 * `issuerPerformance` leads because it is the narrowest section of all: it asks whether the article
 * is the issuer reporting its own results, which no other section is about. Before it existed, an
 * issuer's own earnings release qualified for nothing (`ip-macro-move` excludes single-company news,
 * `cl-peer-named` excludes the issuer by name, `dm-corporate-action` excludes earnings results), so
 * such articles were rejected with "No section met its qualifying rules" unless the model
 * false-matched one of those gates.
 */
export const NEWSLETTER_SECTION_PRECEDENCE: readonly NewsletterSectionId[] = [
  "issuerPerformance",
  "issuerNews",
  "dealsAndMovements",
  "competitiveLandscape",
  "regulatoryPolicyWatch",
  "disruptorsOrTech",
  "industryPulse",
  "quickHits",
];

/**
 * Summarises how many of the given intents map to each newsletter section.
 *
 * Every `QueryAnalysisIntent` is named for the section it feeds, so an intent is used directly
 * as a section id. Always returns an entry for every `NewsletterSectionId` — sections no query
 * can feed, such as `quickHits`, are present with `count: 0, share: 0`. `share` is the fraction
 * of queries claimed by each section, so shares sum to 1.0 over sections with a positive count.
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
    counts[intent] += 1;
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
