import type {
  ArticleRelevanceRow,
  PerSourceRelevanceSignals,
} from "./analysis-relevance-scoring.js";
import {
  clusterEligibleRows,
  clusterSizeHistogram,
  entitySetForRow,
  type ClusterEligibleRow,
} from "./utilities/selection-diversification.js";

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

export type SelectionDiversificationStats = {
  eligibleRows: number;
  clustersFormed: number;
  selectedAfterDiversification: number;
  suppressedAsDuplicates: number;
  largestClusterSize: number;
};

export type RelevanceSelectionDiversifiedOptions = {
  minScore: number;
  remainingBudget: number;
  entityOverlapThreshold?: number;
  titleSimilarityThreshold?: number;
};

export type RelevanceSelectionDiversifiedResult = {
  rows: ArticleRelevanceRow[];
  stats: SelectionDiversificationStats;
};

/**
 * Sorts row indices by score descending, then newer `createdAt`.
 *
 * @param rows - Draft rows with sort metadata.
 */
const sortedRowIndices = (
  rows: readonly RelevanceSelectionInputRow[],
): number[] =>
  rows
    .map((_, index) => index)
    .sort((left, right) => {
      const rowLeft = rows[left]!;
      const rowRight = rows[right]!;
      if (rowRight.score !== rowLeft.score) {
        return rowRight.score - rowLeft.score;
      }
      return (
        rowRight._sortCreatedAt.getTime() - rowLeft._sortCreatedAt.getTime()
      );
    });

/**
 * Returns the highest-scored eligible row index per cluster (cluster representative).
 *
 * @param eligibleIndices - Indices of score-eligible rows.
 * @param rows - Full draft row list.
 * @param clusterIdByEligibleIndex - Cluster id parallel to `eligibleIndices`.
 */
const clusterRepresentativeIndices = (
  eligibleIndices: readonly number[],
  rows: readonly RelevanceSelectionInputRow[],
  clusterIdByEligibleIndex: readonly number[],
): Set<number> => {
  const bestByCluster = new Map<number, number>();
  for (let index = 0; index < eligibleIndices.length; index += 1) {
    const rowIndex = eligibleIndices[index]!;
    const clusterId = clusterIdByEligibleIndex[index]!;
    const existing = bestByCluster.get(clusterId);
    if (existing === undefined) {
      bestByCluster.set(clusterId, rowIndex);
      continue;
    }
    const existingRow = rows[existing]!;
    const candidateRow = rows[rowIndex]!;
    if (candidateRow.score > existingRow.score) {
      bestByCluster.set(clusterId, rowIndex);
      continue;
    }
    if (
      candidateRow.score === existingRow.score &&
      candidateRow._sortCreatedAt.getTime() >
        existingRow._sortCreatedAt.getTime()
    ) {
      bestByCluster.set(clusterId, rowIndex);
    }
  }
  return new Set(bestByCluster.values());
};

/**
 * Applies diversified selection: one cluster representative first, then fills remaining budget by score.
 *
 * Rows below `minScore` stay `selected: false`. Among eligible rows, the highest-scored row per
 * event cluster is preferred before additional rows from the same cluster consume budget slots.
 *
 * @param rows - Draft rows with `_sortCreatedAt` attached.
 * @param perSourceSignals - Per-source entity/title signals for clustering.
 * @param options - Thresholds, `minScore`, and remaining daily budget.
 */
export const applyRelevanceSelectionDiversified = (
  rows: readonly RelevanceSelectionInputRow[],
  perSourceSignals: readonly PerSourceRelevanceSignals[],
  options: RelevanceSelectionDiversifiedOptions,
): RelevanceSelectionDiversifiedResult => {
  const minScore = options.minScore;
  let slots = Math.max(0, Math.floor(options.remainingBudget));
  const order = sortedRowIndices(rows);
  const eligibleIndices = order.filter(
    (index) => rows[index]!.score >= minScore,
  );

  const titleForDataSource = (dataSourceId: string): string => {
    const signals = perSourceSignals.find(
      (row) => row.dataSourceId === dataSourceId,
    );
    return signals?.titleLower ?? "";
  };

  const eligibleRows: ClusterEligibleRow[] = eligibleIndices.map((index) => {
    const row = rows[index]!;
    return { dataSourceId: row.dataSourceId, score: row.score };
  });

  const clusterIdByEligibleIndex =
    eligibleIndices.length === 0
      ? []
      : clusterEligibleRows(eligibleRows, {
          entityOverlapThreshold: options.entityOverlapThreshold,
          titleSimilarityThreshold: options.titleSimilarityThreshold,
          getEntities: (eligibleIndex) =>
            entitySetForRow(
              eligibleRows[eligibleIndex]!.dataSourceId,
              perSourceSignals,
            ),
          getTitle: (eligibleIndex) =>
            titleForDataSource(eligibleRows[eligibleIndex]!.dataSourceId),
        });

  const clusterIdByRowIndex = new Map<number, number>();
  for (let index = 0; index < eligibleIndices.length; index += 1) {
    clusterIdByRowIndex.set(
      eligibleIndices[index]!,
      clusterIdByEligibleIndex[index]!,
    );
  }

  const clusterSizes = clusterSizeHistogram(clusterIdByEligibleIndex);
  const largestClusterSize =
    clusterSizes.size === 0 ? 0 : Math.max(...[...clusterSizes.values()]);

  const representativeIndices = clusterRepresentativeIndices(
    eligibleIndices,
    rows,
    clusterIdByEligibleIndex,
  );

  const selectedIndices = new Set<number>();
  const clusterHasRepresentativePick = new Set<number>();

  for (const index of order) {
    if (rows[index]!.score < minScore || slots <= 0) {
      continue;
    }
    const clusterId = clusterIdByRowIndex.get(index);
    if (clusterId === undefined || !representativeIndices.has(index)) {
      continue;
    }
    if (clusterHasRepresentativePick.has(clusterId)) {
      continue;
    }
    selectedIndices.add(index);
    clusterHasRepresentativePick.add(clusterId);
    slots -= 1;
  }

  for (const index of order) {
    if (rows[index]!.score < minScore || slots <= 0) {
      continue;
    }
    if (selectedIndices.has(index)) {
      continue;
    }
    const clusterId = clusterIdByRowIndex.get(index);
    if (
      clusterId !== undefined &&
      clusterHasRepresentativePick.has(clusterId)
    ) {
      continue;
    }
    selectedIndices.add(index);
    if (clusterId !== undefined) {
      clusterHasRepresentativePick.add(clusterId);
    }
    slots -= 1;
  }

  const classicRows = applyRelevanceSelection(
    rows,
    minScore,
    options.remainingBudget,
  );
  const classicSelectedIds = new Set(
    classicRows.filter((row) => row.selected).map((row) => row.dataSourceId),
  );
  const diversifiedSelectedIds = new Set(
    [...selectedIndices].map((index) => rows[index]!.dataSourceId),
  );

  let suppressedAsDuplicates = 0;
  for (const dataSourceId of classicSelectedIds) {
    if (diversifiedSelectedIds.has(dataSourceId)) {
      continue;
    }
    const rowIndex = rows.findIndex((row) => row.dataSourceId === dataSourceId);
    if (rowIndex < 0 || !representativeIndices.has(rowIndex)) {
      suppressedAsDuplicates += 1;
    }
  }

  const out: ArticleRelevanceRow[] = rows.map((row, index) => ({
    dataSourceId: row.dataSourceId,
    score: row.score,
    scoreBreakdown: row.scoreBreakdown,
    selected: selectedIndices.has(index),
  }));

  return {
    rows: out,
    stats: {
      eligibleRows: eligibleIndices.length,
      clustersFormed: clusterSizes.size,
      selectedAfterDiversification: out.filter((row) => row.selected).length,
      suppressedAsDuplicates,
      largestClusterSize,
    },
  };
};
