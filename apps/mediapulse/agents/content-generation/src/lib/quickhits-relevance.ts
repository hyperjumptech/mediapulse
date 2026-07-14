import type { IndustryNewsletterResolved } from "../industry-newsletter-urls.js";
import type { SourceForGeneration } from "../types.js";

const STRUCTURED_SECTIONS = new Set<string>([
  "competitiveLandscape",
  "dealsAndMovements",
  "regulatoryPolicyWatch",
  "disruptorsOrTech",
]);

export type FilterDemotedQuickHitsResult = {
  resolved: IndustryNewsletterResolved;
  removedCount: number;
};

/**
 * Drops Quick Hits whose article was assigned to a structured section but scored below the bar for
 * it. A high-relevance structured article the model chose to place in Quick Hits still ships; a
 * weakly-relevant one (the padding pattern where an off-topic item is demoted into Quick Hits with
 * stretched prose) is removed. Items assigned Quick Hits, or with no resolvable source, are kept.
 *
 * @param resolved - Newsletter after grounding, prune, and dedup.
 * @param sources - Prompt sources carrying each article's assigned `section` and `sectionScore`.
 * @param minScore - Minimum section-fit score a demoted structured article must clear to stay.
 * @returns The newsletter with low-relevance demoted Quick Hits removed, and how many were removed.
 */
export const filterDemotedQuickHits = (
  resolved: IndustryNewsletterResolved,
  sources: readonly SourceForGeneration[],
  minScore: number,
): FilterDemotedQuickHitsResult => {
  const quickHits = resolved.quickHits;
  if (quickHits === undefined) {
    return { resolved, removedCount: 0 };
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

  const kept = quickHits.items.filter((item) => {
    if (item.url === undefined) {
      return true;
    }
    const meta = metaByUrl.get(item.url);
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

  const removedCount = quickHits.items.length - kept.length;
  if (removedCount === 0) {
    return { resolved, removedCount: 0 };
  }

  const next: IndustryNewsletterResolved = { ...resolved };
  if (kept.length > 0) {
    next.quickHits = { ...quickHits, items: kept };
  } else {
    delete next.quickHits;
  }

  return { resolved: next, removedCount };
};
