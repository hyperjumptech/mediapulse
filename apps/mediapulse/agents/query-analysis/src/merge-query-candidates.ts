import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

/** One deterministic template row before merge. */
export type DeterministicCandidate = {
  text: string;
  intent: QueryAnalysisIntent;
};

/** One LLM row after validation (trimmed text, intent per model output). */
export type LlmCandidate = {
  text: string;
  intent: QueryAnalysisIntent;
};

/** Row persisted via agent-data-api `queryAnalysis.create`. */
export type MergedQueryRow = {
  text: string;
  source: "deterministic" | "llm";
  intent: QueryAnalysisIntent;
  rank: number;
};

/** Relative emphasis for ordering the non-floor pool (same shape as strategy snapshot weights). */
export type QueryMergeWeights = {
  breaking: number;
  kgChange: number;
  fundamental: number;
};

/**
 * Normalizes query text for case-insensitive deduplication: trim, collapse internal whitespace, lowercase.
 *
 * @param text - Raw query string.
 * @returns Normalized key suitable for `Set` deduplication.
 */
export const normalizeQueryKey = (text: string): string =>
  text.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Returns the merge weight for an intent using the configured snapshot weights.
 *
 * @param intent - Query intent label.
 * @param weights - Relative weights (breaking / KG / fundamental).
 * @returns Numeric weight for sorting (higher = kept earlier when capacity is limited).
 */
export const intentMergeWeight = (
  intent: QueryAnalysisIntent,
  weights: QueryMergeWeights,
): number => {
  if (intent === "breaking") {
    return weights.breaking;
  }
  if (intent === "kg_change") {
    return weights.kgChange;
  }
  return weights.fundamental;
};

/**
 * Dedupes deterministic rows by {@link normalizeQueryKey}, preserving first occurrence order.
 *
 * @param deterministic - Template rows (may contain duplicates or empty strings).
 * @returns Non-empty unique rows with original intents.
 */
export const dedupeDeterministic = (
  deterministic: DeterministicCandidate[],
): DeterministicCandidate[] => {
  const seen = new Set<string>();
  const out: DeterministicCandidate[] = [];
  for (const row of deterministic) {
    const text = row.text.trim();
    if (text.length === 0) {
      continue;
    }
    const key = normalizeQueryKey(text);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({ text, intent: row.intent });
  }
  return out;
};

/**
 * Appends LLM rows that are non-empty and not already present in `seenKeys` (mutates `seenKeys`).
 *
 * @param llm - Candidate rows from the model.
 * @param seenKeys - Keys already used (typically from deterministic dedupe).
 * @returns Rows tagged as `source: "llm"`.
 */
export const dedupeLlmAgainstKeys = (
  llm: LlmCandidate[],
  seenKeys: Set<string>,
): Array<{ text: string; intent: QueryAnalysisIntent; source: "llm" }> => {
  const out: Array<{
    text: string;
    intent: QueryAnalysisIntent;
    source: "llm";
  }> = [];
  for (const row of llm) {
    const text = row.text.trim();
    if (text.length === 0) {
      continue;
    }
    const key = normalizeQueryKey(text);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    out.push({ text, intent: row.intent, source: "llm" });
  }
  return out;
};

/**
 * Merges deterministic and LLM candidates: dedupes, enforces a deterministic floor within `queryCount`,
 * orders the extension pool by intent weights (stable), assigns contiguous ranks.
 *
 * @param params - Deterministic templates, LLM rows, caps, and weights.
 * @returns Final query rows ready for persistence (length ≤ `queryCount`, ≥ 1 if inputs allow).
 */
export const mergeQueryCandidates = (params: {
  deterministic: DeterministicCandidate[];
  llm: LlmCandidate[];
  queryCount: number;
  minDeterministicCount: number;
  weights: QueryMergeWeights;
}): MergedQueryRow[] => {
  const { queryCount, minDeterministicCount, weights } = params;
  const dedupedDet = dedupeDeterministic(params.deterministic);
  const effectiveMin = Math.min(
    minDeterministicCount,
    queryCount,
    dedupedDet.length,
  );
  const detFloor = dedupedDet.slice(0, effectiveMin).map((row) => ({
    text: row.text,
    intent: row.intent,
    source: "deterministic" as const,
  }));
  const detExtra = dedupedDet.slice(effectiveMin).map((row) => ({
    text: row.text,
    intent: row.intent,
    source: "deterministic" as const,
  }));
  const seenKeys = new Set(
    dedupedDet.map((row) => normalizeQueryKey(row.text)),
  );
  const llmRows = dedupeLlmAgainstKeys(params.llm, seenKeys);
  const pool = [...detExtra, ...llmRows].map((row, index) => ({
    row,
    index,
    weight: intentMergeWeight(row.intent, weights),
  }));
  pool.sort((a, b) => {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.index - b.index;
  });
  const maxPool = Math.max(0, queryCount - detFloor.length);
  const tail = pool.slice(0, maxPool).map((p) => p.row);
  const combined = [...detFloor, ...tail];
  return combined.map((row, i) => ({
    text: row.text,
    source: row.source,
    intent: row.intent,
    rank: i + 1,
  }));
};
