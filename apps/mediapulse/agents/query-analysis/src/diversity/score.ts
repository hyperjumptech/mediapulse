import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

import { cosineSimilarity } from "../embeddings";

/** Default composite weights for diversity scoring axes. */
export const DEFAULT_DIVERSITY_SCORE_WEIGHTS = {
  lexical: 0.4,
  intent: 0.3,
  semantic: 0.3,
} as const;

export type DiversityScoreWeights = {
  lexical: number;
  intent: number;
  semantic: number;
};

/** One candidate row scored for diversity before merge. */
export type DiversityScoreRow = {
  text: string;
  intent: QueryAnalysisIntent;
  persona?: string;
};

/** Per-axis and composite diversity metrics for a candidate batch. */
export type DiversityScoreResult = {
  lexicalDiversity: number;
  intentCoverage: number;
  personaCoverage?: number;
  semanticSpread?: number;
  composite: number;
};

/** Maximum rows used for O(n²) semantic spread (pairwise distance). */
export const MAX_SEMANTIC_SPREAD_ROWS = 50;

/**
 * Tokenizes query text for lexical diversity (lowercase whitespace tokens).
 *
 * @param text - Raw query string.
 * @returns Non-empty tokens.
 */
export const tokenizeQueryText = (text: string): string[] =>
  text
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

/**
 * Computes distinct-token ratio across all query texts (0–1).
 *
 * @param rows - Candidate rows to score.
 * @returns Lexical diversity; 0 when there are no tokens.
 */
export const computeLexicalDiversity = (rows: DiversityScoreRow[]): number => {
  const tokens: string[] = [];
  for (const row of rows) {
    tokens.push(...tokenizeQueryText(row.text));
  }
  if (tokens.length === 0) {
    return 0;
  }
  return new Set(tokens).size / tokens.length;
};

/**
 * Computes Shannon entropy of categorical values, normalized to [0, 1].
 *
 * @param values - Category labels (e.g. intents or persona ids).
 * @returns Normalized entropy; 0 when fewer than two distinct categories appear.
 */
export const computeNormalizedEntropy = (values: string[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const distinct = counts.size;
  if (distinct <= 1) {
    return 0;
  }
  let entropy = 0;
  const total = values.length;
  for (const count of counts.values()) {
    const probability = count / total;
    entropy -= probability * Math.log(probability);
  }
  return entropy / Math.log(distinct);
};

/**
 * Computes mean pairwise cosine distance (1 − similarity) for embedding vectors.
 *
 * @param embeddings - Row-aligned embedding vectors.
 * @returns Mean distance in [0, 1] when at least two vectors exist; otherwise 0.
 */
export const computeSemanticSpread = (embeddings: number[][]): number => {
  const subset = embeddings.slice(0, MAX_SEMANTIC_SPREAD_ROWS);
  if (subset.length < 2) {
    return 0;
  }
  let pairCount = 0;
  let distanceSum = 0;
  for (let i = 0; i < subset.length; i++) {
    for (let j = i + 1; j < subset.length; j++) {
      const similarity = cosineSimilarity(subset[i]!, subset[j]!);
      distanceSum += 1 - similarity;
      pairCount += 1;
    }
  }
  return pairCount > 0 ? distanceSum / pairCount : 0;
};

/**
 * Builds the weighted composite diversity score from axis metrics.
 *
 * @param axes - Per-axis scores in [0, 1].
 * @param weights - Axis weights (renormalized when semantic is omitted).
 * @returns Composite score in [0, 1].
 */
export const computeCompositeDiversityScore = (
  axes: {
    lexicalDiversity: number;
    intentCoverage: number;
    semanticSpread?: number;
  },
  weights: DiversityScoreWeights,
): number => {
  const terms: Array<{ weight: number; value: number }> = [
    { weight: weights.lexical, value: axes.lexicalDiversity },
    { weight: weights.intent, value: axes.intentCoverage },
  ];
  if (axes.semanticSpread !== undefined) {
    terms.push({ weight: weights.semantic, value: axes.semanticSpread });
  }
  const weightSum = terms.reduce((sum, term) => sum + term.weight, 0);
  if (weightSum <= 0) {
    return 0;
  }
  return (
    terms.reduce((sum, term) => sum + term.weight * term.value, 0) / weightSum
  );
};

/**
 * Computes diversity metrics over LLM candidate rows (pure, no I/O).
 *
 * @param rows - Candidate batch to score.
 * @param opts - Optional axis weights and precomputed embeddings keyed by trimmed text.
 * @returns Per-axis metrics and weighted composite score.
 */
export const computeDiversityScore = (
  rows: DiversityScoreRow[],
  opts: {
    weights?: DiversityScoreWeights;
    embeddingsByText?: ReadonlyMap<string, number[]>;
  } = {},
): DiversityScoreResult => {
  const weights = opts.weights ?? DEFAULT_DIVERSITY_SCORE_WEIGHTS;
  const lexicalDiversity = computeLexicalDiversity(rows);
  const intentCoverage = computeNormalizedEntropy(
    rows.map((row) => row.intent),
  );

  const personaValues = rows
    .map((row) => row.persona)
    .filter((persona): persona is string => persona !== undefined);
  const personaCoverage =
    personaValues.length > 0
      ? computeNormalizedEntropy(personaValues)
      : undefined;

  let semanticSpread: number | undefined;
  if (opts.embeddingsByText && rows.length >= 2) {
    const embeddings = rows
      .map((row) => opts.embeddingsByText?.get(row.text.trim()))
      .filter((vector): vector is number[] => vector !== undefined);
    if (embeddings.length >= 2) {
      semanticSpread = computeSemanticSpread(embeddings);
    }
  }

  const composite = computeCompositeDiversityScore(
    { lexicalDiversity, intentCoverage, semanticSpread },
    weights,
  );

  return {
    lexicalDiversity,
    intentCoverage,
    ...(personaCoverage !== undefined ? { personaCoverage } : {}),
    ...(semanticSpread !== undefined ? { semanticSpread } : {}),
    composite,
  };
};

/**
 * Builds a system-prompt nudge asking the model to broaden a low-diversity batch.
 *
 * @param score - Diversity score breakdown from the prior attempt.
 * @returns Text appended to the generation system prompt for the regenerate pass.
 */
export const buildDiversityBroadenSystemNudge = (
  score: DiversityScoreResult,
): string => {
  const parts = [
    `lexical=${score.lexicalDiversity.toFixed(2)}`,
    `intent=${score.intentCoverage.toFixed(2)}`,
  ];
  if (score.semanticSpread !== undefined) {
    parts.push(`semantic=${score.semanticSpread.toFixed(2)}`);
  }
  if (score.personaCoverage !== undefined) {
    parts.push(`persona=${score.personaCoverage.toFixed(2)}`);
  }
  return [
    `Your last attempt scored low on diversity (composite ${score.composite.toFixed(2)}).`,
    `Breakdown: ${parts.join(", ")}.`,
    "Vary phrasing, intents, and angles.",
  ].join(" ");
};
