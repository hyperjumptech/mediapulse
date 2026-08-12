import {
  MAX_ARTICLES_PER_SECTION,
  type NewsletterDocument,
} from "@workspace/email-templates/newsletter-document";

/** The shape an issue would take if it shipped, before any LLM call. */
export type ShippableShape = {
  articleCount: number;
  sectionCount: number;
};

type SectionedSource = { section?: string | null };

/**
 * Counts how many articles and sections would survive selection.
 *
 * Mirrors `selectArticles`: unsectioned sources never ship, and each section keeps at most
 * {@link MAX_ARTICLES_PER_SECTION}.
 *
 * @param sources - Candidate sources carrying their assigned section.
 * @returns The article and section counts an issue would carry.
 */
export const computeShippableShape = (
  sources: readonly SectionedSource[],
): ShippableShape => {
  const perSection = new Map<string, number>();
  for (const source of sources) {
    const section = source.section;
    if (typeof section !== "string" || section.trim() === "") {
      continue;
    }
    perSection.set(section, (perSection.get(section) ?? 0) + 1);
  }

  let articleCount = 0;
  for (const count of perSection.values()) {
    articleCount += Math.min(count, MAX_ARTICLES_PER_SECTION);
  }

  return { articleCount, sectionCount: perSection.size };
};

export const computeRenderedShape = (
  document: NewsletterDocument,
): ShippableShape => ({
  articleCount: document.sections.reduce(
    (total, section) => total + section.articles.length,
    0,
  ),
  sectionCount: document.sections.length,
});

/**
 * Reports whether an issue carries too little to be worth sending.
 *
 * - Important: the thresholds are calibrated against the 2026-08-05 batch, where a single
 *   competitor earnings table shipped as a whole newsletter. Of the seventeen issues generated
 *   that day only that one falls below this bar; six two-item issues, including the two that
 *   scored highest on review, stay above it. Raising either threshold suppresses good issues.
 *
 * @param shape - Counts from {@link computeShippableShape}.
 * @param thresholds - Minimum articles and sections required to ship.
 * @returns True when the issue should be skipped instead of generated.
 */
export const isBelowShippableFloor = (
  shape: ShippableShape,
  thresholds: { minShippableArticles: number; minShippableSections: number },
): boolean =>
  shape.articleCount < thresholds.minShippableArticles ||
  shape.sectionCount < thresholds.minShippableSections;
