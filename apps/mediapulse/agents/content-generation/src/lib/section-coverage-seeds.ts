export type SectionCoverageSeedSource = {
  dataSourceId: string;
  url: string;
  title: string;
  content?: string | null;
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

    const top = candidates.reduce((best, current) =>
      (current.sectionScore ?? -1) > (best.sectionScore ?? -1) ? current : best,
    );
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
