import type { SourceForGeneration } from "../types.js";
import {
  buildWordShingles,
  shingleJaccardSimilarity,
} from "./citation-grounding.js";
import { tokenize } from "./phrase-link-injector.js";

/** Default Jaccard similarity threshold for near-duplicate title/content detection. */
const DEFAULT_NEAR_DUP_SIMILARITY = 0.6;

/** Result of the LLM input source dedup pass. */
export type DedupLlmInputSourcesResult = {
  sources: SourceForGeneration[];
  removedCount: number;
};

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;!?]+$/, "")
    .trim();

const scoreSourceSimilarity = (
  left: SourceForGeneration,
  right: SourceForGeneration,
): number => {
  const leftText = `${left.title} ${left.content}`;
  const rightText = `${right.title} ${right.content}`;
  const leftShingles = buildWordShingles(tokenize(leftText));
  const rightShingles = buildWordShingles(tokenize(rightText));

  return shingleJaccardSimilarity(leftShingles, rightShingles);
};

/**
 * Removes exact-URL duplicates and near-duplicate stories from a source list.
 *
 * Sources are assumed to be ordered by descending relevance; the first
 * occurrence is always kept.
 *
 * @param sources - Ordered source list (highest relevance first).
 * @param nearDupSimilarity - Jaccard threshold above which two sources are
 *   treated as the same story. Defaults to 0.6.
 */
export const dedupLlmInputSources = (
  sources: SourceForGeneration[],
  nearDupSimilarity: number = DEFAULT_NEAR_DUP_SIMILARITY,
): DedupLlmInputSourcesResult => {
  const seenUrls = new Set<string>();
  const seenNormalizedTitles = new Set<string>();
  const kept: SourceForGeneration[] = [];
  let removedCount = 0;

  for (const source of sources) {
    if (seenUrls.has(source.url)) {
      removedCount++;
      continue;
    }

    const normalizedTitle = normalizeTitle(source.title);
    if (seenNormalizedTitles.has(normalizedTitle)) {
      removedCount++;
      seenUrls.add(source.url);
      continue;
    }

    let isDuplicate = false;
    for (const keptSource of kept) {
      const similarity = scoreSourceSimilarity(source, keptSource);
      if (similarity >= nearDupSimilarity) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      removedCount++;
      seenUrls.add(source.url);
      continue;
    }

    seenUrls.add(source.url);
    seenNormalizedTitles.add(normalizedTitle);
    kept.push(source);
  }

  return { sources: kept, removedCount };
};
