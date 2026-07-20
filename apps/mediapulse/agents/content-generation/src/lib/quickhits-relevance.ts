import type {
  NewsletterDocument,
  NewsletterSection,
} from "@workspace/email-templates/newsletter-document";

import type { SourceForGeneration } from "../types.js";

const STRUCTURED_SECTIONS = new Set<string>([
  "competitiveLandscape",
  "dealsAndMovements",
  "regulatoryPolicyWatch",
  "disruptorsOrTech",
]);

export type FilterDemotedQuickHitsResult = {
  document: NewsletterDocument;
  removedCount: number;
};

/**
 * Drops Quick Hits whose article was assigned to a structured section but scored below the bar for
 * it. A high-relevance structured article the model chose to place in Quick Hits still ships; a
 * weakly-relevant one (the padding pattern where an off-topic item is demoted into Quick Hits with
 * stretched prose) is removed. Items assigned Quick Hits, or with no resolvable source, are kept.
 *
 * @param document - Document after grounding, prune, and dedup.
 * @param sources - Prompt sources carrying each article's assigned `section` and `sectionScore`.
 * @param minScore - Minimum section-fit score a demoted structured article must clear to stay.
 * @returns The document with low-relevance demoted Quick Hits removed, and how many were removed.
 */
export const filterDemotedQuickHits = (
  document: NewsletterDocument,
  sources: readonly SourceForGeneration[],
  minScore: number,
): FilterDemotedQuickHitsResult => {
  const quickHits = document.sections.find(
    (section) => section.key === "quick-hits",
  );
  if (quickHits === undefined) {
    return { document, removedCount: 0 };
  }

  const metaByUrl = new Map<
    string,
    {
      section: string | null | undefined;
      sectionScore: number | null | undefined;
    }
  >();
  for (const source of sources) {
    if (source.url.length > 0) {
      metaByUrl.set(source.url, {
        section: source.section,
        sectionScore: source.sectionScore,
      });
    }
  }

  const kept = quickHits.articles.filter((article) => {
    const meta = metaByUrl.get(article.url);
    if (
      meta === undefined ||
      meta.section === null ||
      meta.section === undefined ||
      !STRUCTURED_SECTIONS.has(meta.section)
    ) {
      return true;
    }

    return (meta.sectionScore ?? 0) >= minScore;
  });

  const removedCount = quickHits.articles.length - kept.length;
  if (removedCount === 0) {
    return { document, removedCount: 0 };
  }

  const sections: NewsletterSection[] = [];
  for (const section of document.sections) {
    if (section.key !== "quick-hits") {
      sections.push(section);
      continue;
    }
    if (kept.length > 0) {
      sections.push({ key: section.key, articles: kept });
    }
  }

  return { document: { version: 1, sections }, removedCount };
};
