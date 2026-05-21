import type { PerSourceRelevanceSignals } from "../analysis-relevance-scoring.js";
import { normalizeEntityName } from "../normalize-entity-name.js";

/** Row slice used for clustering (typically score-eligible relevance drafts). */
export type ClusterEligibleRow = {
  dataSourceId: string;
  score: number;
};

export type ClusterEligibleRowsOptions = {
  entityOverlapThreshold?: number;
  titleSimilarityThreshold?: number;
  getEntities: (index: number) => ReadonlySet<string>;
  getTitle: (index: number) => string;
};

/**
 * Jaccard similarity |A ∩ B| / |A ∪ B| for two sets (0 when both empty).
 *
 * @param left - First set.
 * @param right - Second set.
 */
export const jaccardOverlap = (
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): number => {
  if (left.size === 0 && right.size === 0) {
    return 1;
  }
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

/**
 * Builds the normalized entity and mention name set for one source's signals.
 *
 * @param dataSourceId - Data source id on the relevance row.
 * @param perSourceSignals - Post-extraction signals keyed by `dataSourceId`.
 */
export const entitySetForRow = (
  dataSourceId: string,
  perSourceSignals: readonly PerSourceRelevanceSignals[],
): Set<string> => {
  const signals = perSourceSignals.find(
    (row) => row.dataSourceId === dataSourceId,
  );
  if (signals === undefined || signals.entityNames.length === 0) {
    return new Set();
  }
  return new Set(signals.entityNames);
};

/**
 * Returns lowercase word n-grams (shingles) from a title string.
 *
 * @param title - Article title (typically already lowercased).
 * @param n - Words per shingle (default 4).
 */
export const titleShingles = (title: string, n = 4): Set<string> => {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const shingles = new Set<string>();
  if (words.length < n) {
    if (words.length > 0) {
      shingles.add(words.join(" "));
    }
    return shingles;
  }
  for (let index = 0; index <= words.length - n; index += 1) {
    shingles.add(words.slice(index, index + n).join(" "));
  }
  return shingles;
};

/**
 * Jaccard similarity over two title shingle sets.
 *
 * @param leftTitle - First title.
 * @param rightTitle - Second title.
 * @param n - Shingle width in words.
 */
export const shingleOverlap = (
  leftTitle: string,
  rightTitle: string,
  n = 4,
): number =>
  jaccardOverlap(titleShingles(leftTitle, n), titleShingles(rightTitle, n));

/**
 * Union-find parent array with path compression.
 *
 * @param size - Number of elements.
 */
const createUnionFind = (size: number): number[] =>
  Array.from({ length: size }, (_, index) => index);

/**
 * Finds the root representative for `index`.
 *
 * @param parent - Union-find parent links.
 * @param index - Element index.
 */
const unionFindRoot = (parent: number[], index: number): number => {
  if (parent[index] !== index) {
    parent[index] = unionFindRoot(parent, parent[index]!);
  }
  return parent[index]!;
};

/**
 * Merges two union-find sets.
 *
 * @param parent - Union-find parent links.
 * @param left - First index.
 * @param right - Second index.
 */
const unionFindMerge = (
  parent: number[],
  left: number,
  right: number,
): void => {
  const rootLeft = unionFindRoot(parent, left);
  const rootRight = unionFindRoot(parent, right);
  if (rootLeft !== rootRight) {
    parent[rootRight] = rootLeft;
  }
};

/**
 * Clusters rows with single-pass union-find when entity OR title similarity exceeds thresholds.
 *
 * @param rows - Eligible rows to cluster (caller filters by `minScore`).
 * @param options - Thresholds and per-index entity/title accessors.
 * @returns Parallel cluster id per input row (dense 0..k-1).
 */
export const clusterEligibleRows = (
  rows: readonly ClusterEligibleRow[],
  options: ClusterEligibleRowsOptions,
): number[] => {
  const entityThreshold = options.entityOverlapThreshold ?? 0.5;
  const titleThreshold = options.titleSimilarityThreshold ?? 0.4;
  const count = rows.length;
  if (count === 0) {
    return [];
  }

  const parent = createUnionFind(count);

  for (let left = 0; left < count; left += 1) {
    const leftEntities = options.getEntities(left);
    const leftTitle = options.getTitle(left);
    for (let right = left + 1; right < count; right += 1) {
      const entityAdjacent =
        jaccardOverlap(leftEntities, options.getEntities(right)) >=
        entityThreshold;
      const titleAdjacent =
        shingleOverlap(leftTitle, options.getTitle(right)) >= titleThreshold;
      if (entityAdjacent || titleAdjacent) {
        unionFindMerge(parent, left, right);
      }
    }
  }

  const rootToClusterId = new Map<number, number>();
  const clusterIds: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const root = unionFindRoot(parent, index);
    let clusterId = rootToClusterId.get(root);
    if (clusterId === undefined) {
      clusterId = rootToClusterId.size;
      rootToClusterId.set(root, clusterId);
    }
    clusterIds.push(clusterId);
  }

  return clusterIds;
};

/**
 * Returns cluster sizes keyed by dense cluster id.
 *
 * @param clusterIds - Output of {@link clusterEligibleRows}.
 */
export const clusterSizeHistogram = (
  clusterIds: readonly number[],
): Map<number, number> => {
  const sizes = new Map<number, number>();
  for (const clusterId of clusterIds) {
    sizes.set(clusterId, (sizes.get(clusterId) ?? 0) + 1);
  }
  return sizes;
};

/**
 * Builds normalized entity names from extraction entities and mentions for diversification.
 *
 * @param entities - Capped entities for one source.
 * @param mentionEntityNames - Mention `entityName` values for the same source.
 */
export const buildEntityNamesForDiversification = (
  entities: ReadonlyArray<{
    canonicalName: string;
    aliases: readonly string[];
  }>,
  mentionEntityNames: readonly string[],
): string[] => {
  const names = new Set<string>();
  for (const entity of entities) {
    names.add(normalizeEntityName(entity.canonicalName));
    for (const alias of entity.aliases) {
      names.add(normalizeEntityName(alias));
    }
  }
  for (const mentionName of mentionEntityNames) {
    names.add(normalizeEntityName(mentionName));
  }
  return [...names];
};
