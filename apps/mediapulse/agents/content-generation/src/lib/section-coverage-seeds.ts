import { citedFigures } from "./figures-grounded.js";

export type SectionCoverageSeedSource = {
  dataSourceId: string;
  url: string;
  title: string;
  content?: string | null;
  description?: string | null;
  section?: string | null;
  sectionScore?: number | null;
};

export type SectionCoverageSeed = {
  dataSourceId: string;
  url: string;
  title: string;
  sectionScore: number | null;
  reason: string;
};

const hasBody = (content: unknown): boolean =>
  typeof content === "string" && content.trim() !== "";

/**
 * Whether a candidate's description already asserts a figure, so fetching its body turns that
 * figure from unusable into citable.
 *
 * Breaks ties on `sectionScore`, which the classifier hands out in coarse steps: BBCA's
 * issuerPerformance had fourteen bodiless candidates tied at 0.75 on 2026-08-21 and the seed went
 * to the first of them, an unrelated Sharia-financing article, while the interim-dividend story
 * that led the newsletter went unfetched.
 */
const citesFigure = (source: SectionCoverageSeedSource): boolean =>
  citedFigures(source.description ?? "").length > 0;

/**
 * Picks the highest-scoring description-only source in each requested section so the on-demand
 * fetch always covers the top candidate of every publishable section. Without this, a section
 * whose bullets cite articles that were never fetched loses its citations at grounding and is
 * dropped, even when it held the highest-scored article of the run.
 *
 * Sources that already carry a body are skipped (they need no fetch). At most one seed is returned
 * per section, and a source that tops two sections is returned once.
 *
 * @param sources - Classified sources for the ticker, each carrying `section` and `sectionScore`.
 * @param sections - Sections to guarantee coverage for (the require-citation set).
 * @returns One fetch seed per section that has an un-fetched top candidate, deduped by data source.
 */
export const selectSectionCoverageSeeds = (
  sources: readonly SectionCoverageSeedSource[],
  sections: readonly string[],
): SectionCoverageSeed[] => {
  const seeds: SectionCoverageSeed[] = [];
  const seen = new Set<string>();

  for (const section of sections) {
    const candidates = sources.filter(
      (source) => source.section === section && !hasBody(source.content),
    );
    if (candidates.length === 0) {
      continue;
    }

    const top = candidates.reduce((best, current) => {
      const scoreDiff =
        (current.sectionScore ?? -1) - (best.sectionScore ?? -1);
      if (scoreDiff !== 0) {
        return scoreDiff > 0 ? current : best;
      }

      return citesFigure(current) && !citesFigure(best) ? current : best;
    });
    if (seen.has(top.dataSourceId)) {
      continue;
    }
    seen.add(top.dataSourceId);
    seeds.push({
      dataSourceId: top.dataSourceId,
      url: top.url,
      title: top.title,
      sectionScore: top.sectionScore ?? null,
      reason: `section-coverage: top ${section}`,
    });
  }

  return seeds;
};
