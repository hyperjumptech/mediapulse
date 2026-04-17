import type { ArticleRelevanceRow } from "./analysis-relevance-scoring.js";

export type RelevanceSelectionInputRow = ArticleRelevanceRow & {
  /** Source `createdAt` for stable tie-breaking (not sent on POST). */
  _sortCreatedAt: Date;
};

/**
 * Applies minimum score and top-K selection budget (UTC day budget is pre-computed by the caller).
 * Rows below `minScore` stay `selected: false`. Among the rest, highest scores win; ties break on newer `createdAt`.
 *
 * @param rows - Draft rows with `_sortCreatedAt` attached.
 * @param minScore - Inclusive threshold for eligibility to be marked selected.
 * @param remainingBudget - Max additional `selected: true` rows allowed this run (e.g. daily cap minus already selected).
 * @returns New rows with `selected` set; sorted order is not preserved (only flags matter).
 */
export const applyRelevanceSelection = (
  rows: readonly RelevanceSelectionInputRow[],
  minScore: number,
  remainingBudget: number,
): ArticleRelevanceRow[] => {
  const sorted = [...rows].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b._sortCreatedAt.getTime() - a._sortCreatedAt.getTime();
  });

  let slots = Math.max(0, Math.floor(remainingBudget));
  const out: ArticleRelevanceRow[] = [];

  for (const row of sorted) {
    const eligible = row.score >= minScore && slots > 0;
    const selected = eligible;
    if (eligible) {
      slots -= 1;
    }
    out.push({
      dataSourceId: row.dataSourceId,
      score: row.score,
      scoreBreakdown: row.scoreBreakdown,
      selected,
    });
  }

  return out;
};
