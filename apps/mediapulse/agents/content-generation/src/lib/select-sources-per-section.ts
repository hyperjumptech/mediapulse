import type { SourceForGeneration } from "../types.js";

const NO_SECTION = "__none__";

/**
 * Selects prompt sources fairly across sections instead of by a single global score cut. Sources
 * arrive ordered by section-fit score descending; a section with many high-score articles would
 * otherwise crowd others out of the top-N global slice. A round-robin pass takes each section's top
 * article before any section's second (up to `perSectionCap` per section), then a fill pass tops up
 * to `totalCap` from the remaining sources by score, so a sparse spread does not starve the prompt.
 *
 * @param sources - Sources ordered by score descending, each carrying an assigned `section`.
 * @param perSectionCap - Maximum sources taken from any one section in the fairness pass.
 * @param totalCap - Maximum sources returned overall.
 * @returns The selected sources, section top-ranks first.
 */
export const selectSourcesPerSection = (
  sources: readonly SourceForGeneration[],
  perSectionCap: number,
  totalCap: number,
): SourceForGeneration[] => {
  const bySection = new Map<string, SourceForGeneration[]>();
  const sectionOrder: string[] = [];
  for (const source of sources) {
    const key = source.section ?? NO_SECTION;
    let bucket = bySection.get(key);
    if (bucket === undefined) {
      bucket = [];
      bySection.set(key, bucket);
      sectionOrder.push(key);
    }
    bucket.push(source);
  }

  const selected: SourceForGeneration[] = [];
  const chosen = new Set<SourceForGeneration>();
  for (
    let rank = 0;
    rank < perSectionCap && selected.length < totalCap;
    rank += 1
  ) {
    for (const key of sectionOrder) {
      if (selected.length >= totalCap) {
        break;
      }
      const source = bySection.get(key)?.[rank];
      if (source !== undefined) {
        selected.push(source);
        chosen.add(source);
      }
    }
  }

  for (const source of sources) {
    if (selected.length >= totalCap) {
      break;
    }
    if (!chosen.has(source)) {
      selected.push(source);
      chosen.add(source);
    }
  }

  return selected;
};
