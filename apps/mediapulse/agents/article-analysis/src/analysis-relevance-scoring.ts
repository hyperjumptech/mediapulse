import type { PostAnalysisBody } from "@workspace/agent-data-api-contract";

/**
 * Canonical v1 keys for `scoreBreakdown` on article relevance (MP-ART-ANALYSIS-006 / GitHub #216).
 * Aligns with product dimensions: breaking news, KG relation change, fundamentals, ticker salience, source quality.
 */
export const RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1 = [
  "breakingNews",
  "kgRelation",
  "fundamental",
  "tickerSalience",
  "sourceQuality",
] as const;

/** Numeric map for weighted score (excludes `_version` and experimental keys). */
export type RelevanceWeightMapV1 = Record<
  (typeof RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1)[number],
  number
>;

export type PerSourceRelevanceSignals = {
  dataSourceId: string;
  createdAt: Date;
  entityCount: number;
  relationCount: number;
  mentionCount: number;
  avgMentionConfidence: number;
  titleLower: string;
  textLower: string;
  /** When set (source quality v2), replaces the fixed 0.5 `sourceQuality` breakdown value. */
  sourceQualityScore?: number;
  /** Normalized canonical names and aliases for selection diversification clustering. */
  entityNames: readonly string[];
};

export type ArticleRelevanceRow = PostAnalysisBody["articleRelevances"][number];

const BREAKING_HINTS =
  /\b(breaking|urgent|halt|crash|plunge|surge|lawsuit|investigation|sec investigation|wire:|alert)\b/i;
const FUNDAMENTAL_HINTS =
  /\b(earnings|revenue|eps|guidance|ebitda|margin|dividend|buyback|10-k|10-q|8-k|fiscal|outlook|forecast)\b/i;

/**
 * Clamps a number into `[0, 1]`.
 *
 * @param n - Raw value.
 * @returns Clamped value.
 */
export const clampUnitInterval = (n: number): number =>
  Math.min(1, Math.max(0, n));

/**
 * Heuristic v1: derives normalized subscores in `[0, 1]` from per-source extraction signals (no extra LLM call).
 *
 * @param signals - Counts and text snippets for one `DataSource`.
 * @param scoreBreakdownVersion - Stored as `scoreBreakdown._version` for chart/schema compatibility.
 * @returns Breakdown including `_version` and the five canonical keys (optionally more experimental keys later).
 */
export const buildScoreBreakdownV1 = (
  signals: PerSourceRelevanceSignals,
  scoreBreakdownVersion: number,
): Record<string, number> => {
  const haystack = `${signals.titleLower}\n${signals.textLower}`;
  const breakingNews = clampUnitInterval(
    BREAKING_HINTS.test(haystack) ? 0.82 : 0.25,
  );
  const kgRelation = clampUnitInterval(
    signals.relationCount === 0
      ? 0.15
      : Math.min(1, 0.35 + signals.relationCount * 0.12),
  );
  const fundamental = clampUnitInterval(
    FUNDAMENTAL_HINTS.test(haystack) ? 0.2 : 0.28,
  );
  const tickerSalience = clampUnitInterval(
    signals.mentionCount === 0 && signals.entityCount === 0
      ? 0.12
      : Math.min(
          1,
          0.2 +
            signals.mentionCount * 0.1 +
            signals.avgMentionConfidence * 0.45 +
            Math.min(0.25, signals.entityCount * 0.04),
        ),
  );
  const sourceQuality = clampUnitInterval(signals.sourceQualityScore ?? 0.5);

  return {
    _version: scoreBreakdownVersion,
    breakingNews,
    kgRelation,
    fundamental,
    tickerSalience,
    sourceQuality,
  };
};

/**
 * Weighted aggregate score over canonical v1 keys only (`_version` excluded).
 *
 * @param breakdown - Map including canonical keys and optional extras.
 * @param weights - Non-negative weights (should sum to ~1 for interpretability).
 * @returns Score in `[0, 1]` before row-level clamp.
 */
export const computeWeightedScore = (
  breakdown: Readonly<Record<string, unknown>>,
  weights: RelevanceWeightMapV1,
): number => {
  let s = 0;
  for (const key of RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1) {
    const raw = breakdown[key];
    const v = typeof raw === "number" ? raw : 0;
    s += weights[key] * v;
  }
  return clampUnitInterval(s);
};

/**
 * Builds a relevance POST row with `selected: false` (selection applied later).
 *
 * Expects {@link PerSourceRelevanceSignals} counts after post-extraction entity grounding
 * so ticker salience and mention confidence reflect grounded entities only.
 *
 * @param signals - Source signals after extraction caps and grounding.
 * @param scoreBreakdownVersion - `_version` in breakdown JSON.
 * @param weights - Hermes-configured weights.
 * @returns One `articleRelevances` element.
 */
export const buildDraftRelevanceRow = (
  signals: PerSourceRelevanceSignals,
  scoreBreakdownVersion: number,
  weights: RelevanceWeightMapV1,
): ArticleRelevanceRow => {
  const scoreBreakdown = buildScoreBreakdownV1(signals, scoreBreakdownVersion);
  const score = computeWeightedScore(scoreBreakdown, weights);
  return {
    dataSourceId: signals.dataSourceId,
    score,
    scoreBreakdown:
      scoreBreakdown as PostAnalysisBody["articleRelevances"][number]["scoreBreakdown"],
    selected: false,
  };
};

/**
 * Returns an error message if the row cannot be posted, otherwise `null`.
 *
 * @param row - Candidate relevance row.
 * @param weights - Same weights used to compute `row.score`.
 * @param epsilon - Tolerance for floating score comparison.
 * @returns Human-readable validation failure or `null`.
 */
export const validateRelevanceRowForPost = (
  row: ArticleRelevanceRow,
  weights: RelevanceWeightMapV1,
  epsilon = 1e-6,
): string | null => {
  if (row.score < 0 || row.score > 1) {
    return "relevance score must be in [0, 1]";
  }
  const b = row.scoreBreakdown;
  if (Object.keys(b).length === 0) {
    return "scoreBreakdown must be non-empty";
  }
  const ver = b._version;
  if (
    typeof ver !== "number" ||
    !Number.isFinite(ver) ||
    !Number.isInteger(ver) ||
    ver < 1
  ) {
    return "scoreBreakdown._version must be an integer >= 1";
  }
  for (const key of RELEVANCE_BREAKDOWN_CANONICAL_KEYS_V1) {
    const v = b[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      return `scoreBreakdown.${key} must be a number in [0, 1]`;
    }
  }
  const expected = computeWeightedScore(b, weights);
  if (Math.abs(expected - row.score) > epsilon) {
    return `score ${row.score} does not match weighted breakdown (expected ~${expected})`;
  }
  return null;
};
