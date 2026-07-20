import type { NewsletterDraft } from "../newsletter-draft-schema.js";
import type { SourceForGeneration } from "../types.js";
import { tokenize } from "./phrase-link-injector.js";

/** How a single citation row is handled after overlap scoring. */
export type GroundingDecision =
  | { kind: "pass" }
  | { kind: "unlink"; reason: "low_overlap" | "no_source" }
  | { kind: "drop"; reason: "low_overlap" | "no_source" };

/** Per-row grounding outcome for run details (not info-level logs). */
export type BulletGroundingReport = {
  sectionKey: string;
  bulletIndex: number;
  articleIndex: number | null;
  overlapScore: number;
  decision: GroundingDecision;
};

/** Rolled-up counters emitted once per newsletter run. */
export type CitationGroundingSummary = {
  totalCitations: number;
  unlinked: number;
  dropped: number;
  floorPreserved: number;
  p50Overlap: number;
  p10Overlap: number;
};

export type CitationGroundingPolicy = "warn" | "unlink" | "drop";

export type CitationGroundingOptions = {
  policy: CitationGroundingPolicy;
  minOverlapScore: number;
  numericBonus: number;
};

export type GroundNewsletterCitationsResult = {
  draft: NewsletterDraft;
  reports: BulletGroundingReport[];
  summary: CitationGroundingSummary;
  /** Quick-hit rows kept despite failed grounding to preserve schema minimums. */
  quickHitsKeptDespiteFailedGrounding: number;
};

const SHINGLE_SIZE = 3;
const ARTICLE_BODY_CHAR_LIMIT = 2000;
const NUMERIC_PATTERN = /\d+(?:[.,]\d+)?/g;

/**
 * Above this many article shingles the source is treated as a full body and scored on Jaccard
 * alone. At or below it the source is description-only, where Jaccard under-scores a faithful
 * bullet (the bullet is longer than the snippet), so a containment fallback also applies.
 */
const SHORT_SOURCE_SHINGLE_MAX = 50;

/** Minimum shared distinctive 3-grams before the short-source containment fallback can ground a bullet. */
const MIN_CONTAINMENT_SHARED = 2;

/** Minimum shared entity/number anchors before the language-neutral fallback can ground a bullet. */
const MIN_SHARED_ANCHORS = 3;

/**
 * Distinctive, translation-stable tokens (named entities and multi-digit figures) from a token list.
 * Short common words are excluded so the anchor overlap keys on names and numbers, which survive an
 * English-bullet / Indonesian-source language gap where word n-grams do not.
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
 * Articles a section must retain after grounding. The floor exists to satisfy the stored
 * document's schema minimum, which is one article per section for every section.
 */
const SECTION_MIN_ARTICLES = 1;

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
  const [small, large] =
    left.size <= right.size ? [left, right] : [right, left];
  let count = 0;
  for (const shingle of small) {
    if (large.has(shingle)) {
      count += 1;
    }
  }

  return count;
};

/**
 * Returns true when a distinctive numeric figure in the bullet appears in the article text.
 *
 * Single-digit figures are ignored: a lone digit (e.g. the "5" in "5G") matches almost
 * every article and would ground an unrelated citation on coincidence alone.
 *
 * @param bulletText - Generated bullet or quick-hit text.
 * @param articleText - Title plus truncated body used for grounding.
 */
export const bulletNumbersMatchArticle = (
  bulletText: string,
  articleText: string,
): boolean => {
  const bulletNumbers = bulletText.match(NUMERIC_PATTERN) ?? [];
  const distinctiveNumbers = bulletNumbers.filter(
    (value) => value.replace(/[.,]/g, "").length >= 2,
  );
  if (distinctiveNumbers.length === 0) {
    return false;
  }

  const normalizedArticle = articleText.replace(/,/g, "");
  return distinctiveNumbers.some((value) =>
    normalizedArticle.includes(value.replace(/,/g, "")),
  );
};

/**
 * Scores how well a bullet's cited claim overlaps its source article.
 *
 * Uses 3-gram Jaccard over stopword-filtered tokens plus an optional numeric bonus.
 * The numeric bonus only reinforces a non-zero textual overlap; it never grounds a
 * bullet on its own, so a fabricated claim cannot pass on a coincidental shared figure.
 *
 * @param bulletText - Generated bullet or quick-hit text.
 * @param article - Cited source row from the prompt list.
 * @param options - Numeric bonus applied when figures match the article body.
 */
export const scoreBulletAgainstArticle = (
  bulletText: string,
  article: SourceForGeneration,
  options: { numericBonus?: number } = {},
): number => {
  const numericBonus = options.numericBonus ?? 0.2;
  const articleText = `${article.title}\n${article.content.slice(0, ARTICLE_BODY_CHAR_LIMIT)}`;
  const bulletTokens = tokenize(bulletText);
  const articleTokens = tokenize(articleText);
  const bulletShingles = buildWordShingles(bulletTokens);
  const articleShingles = buildWordShingles(articleTokens);
  const shared = shingleIntersectionCount(bulletShingles, articleShingles);
  let score = shingleJaccardSimilarity(bulletShingles, articleShingles);

  // Grounding asks "is the bullet supported by the article", which is containment, not Jaccard.
  // Jaccard is dominated by article length: a fully-supported ~18-shingle bullet against a
  // ~200-shingle body scores ~0.09, below any sane floor, so structured-section bullets citing a
  // full article body can never ground under Jaccard. Both containment directions are guarded by a
  // minimum shared-3-gram count so a lone coincidental match cannot ground a bullet.
  if (shared >= MIN_CONTAINMENT_SHARED) {
    // Long/full-body sources: how much of the bullet appears in the article.
    if (bulletShingles.size > 0) {
      score = Math.max(score, shared / bulletShingles.size);
    }
    // Short (description-only) sources: a faithful bullet outweighs the snippet, so measure how
    // fully the snippet appears in the bullet instead.
    if (
      articleShingles.size > 0 &&
      articleShingles.size <= SHORT_SOURCE_SHINGLE_MAX
    ) {
      score = Math.max(score, shared / articleShingles.size);
    }
  }

  // Language-neutral anchor overlap: the newsletter is written in English from mostly Indonesian
  // sources, so a faithful bullet shares no word 3-grams with its article and scores ~0. Named
  // entities and figures survive translation (tokens are case-folded), so ground on how many of the
  // bullet's distinctive anchors appear in the article, guarded by a minimum shared count so reusing
  // one or two names cannot ground a fabricated claim.
  const bulletAnchors = distinctiveAnchorTokens(bulletTokens);
  if (bulletAnchors.size > 0) {
    const articleAnchors = distinctiveAnchorTokens(articleTokens);
    let sharedAnchors = 0;
    for (const anchor of bulletAnchors) {
      if (articleAnchors.has(anchor)) {
        sharedAnchors += 1;
      }
    }
    if (sharedAnchors >= MIN_SHARED_ANCHORS) {
      score = Math.max(score, sharedAnchors / bulletAnchors.size);
    }
  }

  if (score > 0 && bulletNumbersMatchArticle(bulletText, articleText)) {
    score = Math.min(1, score + numericBonus);
  }

  return score;
};

type PendingCitationRow = {
  sectionKey: string;
  bulletIndex: number;
  articleIndex: number;
  overlapScore: number;
  reason: "low_overlap" | "no_source" | null;
};

/**
 * Returns the p-th percentile from a numeric array (0–1).
 *
 * @param values - Sample values (may be empty).
 * @param percentile - Percentile in [0, 1].
 */
export const percentile = (values: readonly number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.floor((sorted.length - 1) * p);
  return sorted[index] ?? 0;
};

/**
 * Verifies newsletter citations against source overlap.
 *
 * An article that fails grounding cannot be stored: the document schema requires a `url`, so an
 * `unlink` decision removes the article exactly as a `drop` does. The two remain distinct in the
 * reports so the run-details counters keep their prior meaning.
 *
 * @param draft - Validated model output.
 * @param sources - Ordered prompt sources (`Article 1` first).
 * @param opts - Grounding policy and scoring thresholds.
 */
export const groundNewsletterCitations = (
  draft: NewsletterDraft,
  sources: readonly SourceForGeneration[],
  opts: CitationGroundingOptions,
): GroundNewsletterCitationsResult => {
  const pending: PendingCitationRow[] = [];
  const reports: BulletGroundingReport[] = [];

  for (const section of draft.sections) {
    section.articles.forEach((article, bulletIndex) => {
      const source = sources[article.articleIndex - 1];
      let overlapScore = 0;
      let reason: "low_overlap" | "no_source" | null = null;

      if (source === undefined) {
        reason = "no_source";
      } else {
        overlapScore = scoreBulletAgainstArticle(
          article.points.join(" "),
          source,
          { numericBonus: opts.numericBonus },
        );
        if (overlapScore < opts.minOverlapScore) {
          reason = "low_overlap";
        }
      }

      pending.push({
        sectionKey: section.key,
        bulletIndex,
        articleIndex: article.articleIndex,
        overlapScore,
        reason,
      });
    });
  }

  const decide = (row: PendingCitationRow): GroundingDecision => {
    if (row.reason === null) {
      return { kind: "pass" };
    }
    if (opts.policy === "warn") {
      return { kind: "pass" };
    }
    if (row.sectionKey === "quick-hits") {
      return { kind: "drop", reason: row.reason };
    }
    if (opts.policy === "unlink") {
      return { kind: "unlink", reason: row.reason };
    }

    return { kind: "drop", reason: row.reason };
  };

  const decisionKeyFor = (row: PendingCitationRow): string =>
    `${row.sectionKey}:${String(row.bulletIndex)}`;

  const decisions = new Map<string, GroundingDecision>();
  for (const row of pending) {
    decisions.set(decisionKeyFor(row), decide(row));
  }

  let floorPreserved = 0;
  let quickHitsKeptDespiteFailedGrounding = 0;

  for (const section of draft.sections) {
    const sectionRows = pending.filter((row) => row.sectionKey === section.key);
    const removedRows = sectionRows.filter(
      (row) => decisions.get(decisionKeyFor(row))?.kind !== "pass",
    );

    if (sectionRows.length - removedRows.length >= SECTION_MIN_ARTICLES) {
      continue;
    }

    const rescueNeeded =
      SECTION_MIN_ARTICLES - (sectionRows.length - removedRows.length);
    if (section.key === "quick-hits") {
      // Keep only enough failed quick hits to meet the schema minimum, and keep the
      // highest-overlap ones, so the section satisfies the count without padding with the
      // weakest ungrounded items.
      const rescued = [...removedRows]
        .sort((left, right) => right.overlapScore - left.overlapScore)
        .slice(0, Math.max(0, rescueNeeded));
      for (const row of rescued) {
        decisions.set(decisionKeyFor(row), { kind: "pass" });
        quickHitsKeptDespiteFailedGrounding += 1;
      }
      continue;
    }

    for (const row of removedRows) {
      const prior = decisions.get(decisionKeyFor(row));
      if (prior?.kind === "drop") {
        decisions.set(decisionKeyFor(row), {
          kind: "unlink",
          reason: prior.reason,
        });
        floorPreserved += 1;
      }
    }
  }

  const groundedSections: NewsletterDraft["sections"] = [];
  for (const section of draft.sections) {
    const keptArticles = section.articles.filter((article, bulletIndex) => {
      const decision = decisions.get(
        `${section.key}:${String(bulletIndex)}`,
      ) ?? { kind: "pass" as const };
      const row = pending.find(
        (candidate) =>
          candidate.sectionKey === section.key &&
          candidate.bulletIndex === bulletIndex,
      );
      reports.push({
        sectionKey: section.key,
        bulletIndex,
        articleIndex: article.articleIndex,
        overlapScore: row?.overlapScore ?? 0,
        decision,
      });

      return decision.kind === "pass";
    });

    if (keptArticles.length > 0) {
      groundedSections.push({ key: section.key, articles: keptArticles });
    }
  }

  const overlapScores = reports.map((report) => report.overlapScore);
  const summary: CitationGroundingSummary = {
    totalCitations: reports.length,
    unlinked: reports.filter((report) => report.decision.kind === "unlink")
      .length,
    dropped: reports.filter((report) => report.decision.kind === "drop").length,
    floorPreserved,
    p50Overlap: percentile(overlapScores, 0.5),
    p10Overlap: percentile(overlapScores, 0.1),
  };

  return {
    draft: { subject: draft.subject, sections: groundedSections },
    reports,
    summary,
    quickHitsKeptDespiteFailedGrounding,
  };
};
