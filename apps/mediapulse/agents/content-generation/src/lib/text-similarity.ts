import type { SourceForGeneration } from "../types.js";
import { tokenize } from "./phrase-link-injector.js";

const SHINGLE_SIZE = 3;

/** Minimum shared 3-grams before the containment fallback may raise a score. */
const MIN_CONTAINMENT_SHARED = 2;

/** Minimum shared entity/number anchors before the language-neutral fallback may raise a score. */
const MIN_SHARED_ANCHORS = 3;

/**
 * Characters of source body compared during dedup.
 *
 * Bounded to the lead paragraphs because that is the part of an article a summary is drawn
 * from, and because an unbounded body would swamp every similarity measure with filler.
 */
export const DEDUP_COMPARISON_CHAR_LIMIT = 300;

/**
 * Builds word n-gram shingles from tokenized text.
 *
 * @param tokens - Filtered content tokens.
 * @param size - Shingle width (default 3).
 */
export const buildWordShingles = (
  tokens: readonly string[],
  size: number = SHINGLE_SIZE,
): Set<string> => {
  const shingles = new Set<string>();
  if (tokens.length === 0) {
    return shingles;
  }

  const effectiveSize = Math.min(size, tokens.length);
  for (let index = 0; index <= tokens.length - effectiveSize; index += 1) {
    shingles.add(tokens.slice(index, index + effectiveSize).join(" "));
  }

  return shingles;
};

/**
 * Computes Jaccard similarity between two shingle sets.
 *
 * @param left - First shingle set.
 * @param right - Second shingle set.
 */
export const shingleJaccardSimilarity = (
  left: Set<string>,
  right: Set<string>,
): number => {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const shingle of left) {
    if (right.has(shingle)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;

  return union === 0 ? 0 : intersection / union;
};

/**
 * Counts shingles present in both sets.
 *
 * @param left - First shingle set.
 * @param right - Second shingle set.
 */
export const shingleIntersectionCount = (
  left: Set<string>,
  right: Set<string>,
): number => {
  const [smaller, larger] =
    left.size <= right.size ? [left, right] : [right, left];
  let count = 0;
  for (const shingle of smaller) {
    if (larger.has(shingle)) {
      count += 1;
    }
  }

  return count;
};

/**
 * Distinctive, translation-stable tokens (named entities and multi-digit figures) from a token list.
 *
 * Short common words are excluded so the anchor overlap keys on names and numbers, which survive an
 * English-summary / Indonesian-source language gap where word n-grams do not.
 *
 * @param tokens - Case-folded, stopword-filtered tokens (from `tokenize`).
 * @returns The set of anchor tokens.
 */
export const distinctiveAnchorTokens = (
  tokens: readonly string[],
): Set<string> => {
  const anchors = new Set<string>();
  for (const token of tokens) {
    if (token.length >= 4 || /^\d{2,}$/.test(token)) {
      anchors.add(token);
    }
  }

  return anchors;
};

/**
 * Scores how strongly a short probe text is echoed by a longer reference text.
 *
 * Plain Jaccard is dominated by length, so a faithful one-line probe against a lead paragraph
 * scores near zero. Two length-robust fallbacks raise the score: how much of the probe appears in
 * the reference, and how many of the probe's distinctive anchors appear in it. Both are guarded by
 * a minimum shared count so a lone coincidental match cannot score.
 *
 * @param probeText - The shorter text being tested, such as a previously published bullet.
 * @param referenceText - The longer text it is tested against, such as an article lead.
 * @returns A score in [0, 1].
 */
export const scoreTextAgainstText = (
  probeText: string,
  referenceText: string,
): number => {
  const probeTokens = tokenize(probeText);
  const referenceTokens = tokenize(referenceText);
  const probeShingles = buildWordShingles(probeTokens);
  const referenceShingles = buildWordShingles(referenceTokens);
  const sharedShingles = shingleIntersectionCount(
    probeShingles,
    referenceShingles,
  );
  let score = shingleJaccardSimilarity(probeShingles, referenceShingles);

  if (sharedShingles >= MIN_CONTAINMENT_SHARED && probeShingles.size > 0) {
    score = Math.max(score, sharedShingles / probeShingles.size);
  }

  const probeAnchors = distinctiveAnchorTokens(probeTokens);
  if (probeAnchors.size > 0) {
    const referenceAnchors = distinctiveAnchorTokens(referenceTokens);
    const sharedAnchors = shingleIntersectionCount(
      probeAnchors,
      referenceAnchors,
    );
    if (sharedAnchors >= MIN_SHARED_ANCHORS) {
      score = Math.max(score, sharedAnchors / probeAnchors.size);
    }
  }

  return score;
};

/**
 * Builds the bounded text used to compare one candidate source against another.
 *
 * @param source - Candidate source.
 * @returns The source's title followed by its lead body text.
 */
export const buildSourceComparisonText = (
  source: SourceForGeneration,
): string =>
  `${source.title}\n${source.content.slice(0, DEDUP_COMPARISON_CHAR_LIMIT)}`;
