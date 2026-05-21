import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

import type { QuerySemanticEmbedder } from "./embeddings";
import { maxCosineSimilarity } from "./embeddings";

/** One deterministic template row before merge. */
export type DeterministicCandidate = {
  text: string;
  intent: QueryAnalysisIntent;
};

/** One LLM row after validation (trimmed text, intent per model output). */
export type LlmCandidate = {
  text: string;
  intent: QueryAnalysisIntent;
  /** Persona id when produced by multi-persona fan-out (observability only). */
  persona?: string;
};

/** Row persisted via agent-data-api `queryAnalysis.create`. */
export type MergedQueryRow = {
  text: string;
  source: "deterministic" | "llm";
  intent: QueryAnalysisIntent;
  rank: number;
  /** Persona id for LLM rows from multi-persona fan-out (observability only). */
  persona?: string;
};

import type { QueryAnalysisIntentWeights } from "@workspace/agent-data-api-contract";

/** Relative emphasis for ordering the non-floor pool keyed by intent label. */
export type QueryMergeWeights = QueryAnalysisIntentWeights;

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
 * @param weights - Relative weights keyed by intent.
 * @returns Numeric weight for sorting (unknown intents default to 0).
 */
export const intentMergeWeight = (
  intent: QueryAnalysisIntent,
  weights: QueryMergeWeights,
): number => weights[intent] ?? 0;

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
): Array<{
  text: string;
  intent: QueryAnalysisIntent;
  source: "llm";
  persona?: string;
}> => {
  const out: Array<{
    text: string;
    intent: QueryAnalysisIntent;
    source: "llm";
    persona?: string;
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
    out.push({
      text,
      intent: row.intent,
      source: "llm",
      ...(row.persona !== undefined ? { persona: row.persona } : {}),
    });
  }
  return out;
};

/**
 * Dedupes LLM rows by cosine similarity against deterministic anchors and prior accepts.
 * Deterministic anchors are never dropped; they only constrain later LLM rows.
 *
 * @param llm - LLM candidate rows from the model.
 * @param anchorRows - String-deduped deterministic rows used as similarity anchors.
 * @param embedder - Precomputed embeddings for the run.
 * @returns Rows tagged as `source: "llm"`.
 */
export const dedupeLlmBySimilarity = (
  llm: LlmCandidate[],
  anchorRows: DeterministicCandidate[],
  embedder: QuerySemanticEmbedder,
): Array<{
  text: string;
  intent: QueryAnalysisIntent;
  source: "llm";
  persona?: string;
}> => {
  const acceptedEmbeddings: number[][] = [];
  for (const anchor of anchorRows) {
    const text = anchor.text.trim();
    if (text.length === 0) {
      continue;
    }
    const embedding = embedder.embeddingByText.get(text);
    if (embedding) {
      acceptedEmbeddings.push(embedding);
    }
  }

  const out: Array<{
    text: string;
    intent: QueryAnalysisIntent;
    source: "llm";
    persona?: string;
  }> = [];

  for (const row of llm) {
    const text = row.text.trim();
    if (text.length === 0) {
      continue;
    }
    const embedding = embedder.embeddingByText.get(text);
    if (
      embedding &&
      maxCosineSimilarity(embedding, acceptedEmbeddings) > embedder.threshold
    ) {
      continue;
    }
    if (embedding) {
      acceptedEmbeddings.push(embedding);
    }
    out.push({
      text,
      intent: row.intent,
      source: "llm",
      ...(row.persona !== undefined ? { persona: row.persona } : {}),
    });
  }

  return out;
};

type PoolRow = {
  text: string;
  intent: QueryAnalysisIntent;
  source: "deterministic" | "llm";
  persona?: string;
};

/**
 * Sorts pool rows by intent merge weight with stable tie-breaking on input index.
 *
 * @param rows - Candidate rows with original indices.
 * @param weights - Relative intent weights from strategy snapshot.
 * @returns Rows ordered by descending weight.
 */
export const sortPoolByIntentWeight = (
  rows: Array<{ row: PoolRow; index: number }>,
  weights: QueryMergeWeights,
): PoolRow[] => {
  const pool = rows.map((entry) => ({
    ...entry,
    weight: intentMergeWeight(entry.row.intent, weights),
  }));
  pool.sort((a, b) => {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.index - b.index;
  });
  return pool.map((entry) => entry.row);
};

/**
 * Orders persona-tagged LLM rows in round-robin across persona ids, preserving
 * first-seen persona order. Within each persona, rows keep input order.
 *
 * @param llmRows - Deduped LLM rows that may carry persona tags.
 * @returns LLM rows interleaved A, B, C, A, … when personas are present.
 */
export const orderLlmRowsByPersonaRoundRobin = (
  llmRows: Array<PoolRow & { persona?: string }>,
): PoolRow[] => {
  const personaOrder: string[] = [];
  const buckets = new Map<string, PoolRow[]>();
  const withoutPersona: PoolRow[] = [];

  for (const row of llmRows) {
    if (row.persona === undefined) {
      withoutPersona.push(row);
      continue;
    }
    if (!buckets.has(row.persona)) {
      personaOrder.push(row.persona);
      buckets.set(row.persona, []);
    }
    buckets.get(row.persona)?.push(row);
  }

  if (personaOrder.length === 0) {
    return llmRows;
  }

  const indices = new Map(personaOrder.map((id) => [id, 0]));
  const ordered: PoolRow[] = [];
  let remaining = llmRows.length - withoutPersona.length;

  while (remaining > 0) {
    let progressed = false;
    for (const personaId of personaOrder) {
      const bucket = buckets.get(personaId) ?? [];
      const index = indices.get(personaId) ?? 0;
      if (index < bucket.length) {
        ordered.push(bucket[index]!);
        indices.set(personaId, index + 1);
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) {
      break;
    }
  }

  return [...ordered, ...withoutPersona];
};

/**
 * Merges deterministic and LLM candidates: dedupes, enforces a deterministic floor within `queryCount`,
 * orders the extension pool by intent weights (stable), assigns contiguous ranks.
 *
 * @param params - Deterministic templates, LLM rows, caps, weights, and optional embedder.
 * @returns Final query rows ready for persistence (length ≤ `queryCount`, ≥ 1 if inputs allow).
 */
export const mergeQueryCandidates = (params: {
  deterministic: DeterministicCandidate[];
  llm: LlmCandidate[];
  queryCount: number;
  minDeterministicCount: number;
  weights: QueryMergeWeights;
  embedder?: QuerySemanticEmbedder;
}): MergedQueryRow[] => {
  const { queryCount, minDeterministicCount, weights } = params;
  const dedupedDet = dedupeDeterministic(params.deterministic);
  const effectiveMin = Math.min(
    minDeterministicCount,
    queryCount,
    dedupedDet.length,
  );
  const detFloor: PoolRow[] = dedupedDet.slice(0, effectiveMin).map((row) => ({
    text: row.text,
    intent: row.intent,
    source: "deterministic" as const,
  }));
  const detExtra: PoolRow[] = dedupedDet.slice(effectiveMin).map((row) => ({
    text: row.text,
    intent: row.intent,
    source: "deterministic" as const,
  }));
  const seenKeys = new Set(
    dedupedDet.map((row) => normalizeQueryKey(row.text)),
  );
  const llmRows = params.embedder
    ? dedupeLlmBySimilarity(params.llm, dedupedDet, params.embedder)
    : dedupeLlmAgainstKeys(params.llm, seenKeys);
  const hasPersonaTaggedLlm = llmRows.some((row) => row.persona !== undefined);

  const detExtraIndexed = detExtra.map((row, index) => ({ row, index }));
  const llmIndexed = llmRows.map((row, index) => ({
    row,
    index: detExtra.length + index,
  }));

  let tail: PoolRow[];
  if (hasPersonaTaggedLlm) {
    const detExtraOrdered = sortPoolByIntentWeight(detExtraIndexed, weights);
    const llmOrdered = orderLlmRowsByPersonaRoundRobin(
      llmIndexed.map((entry) => entry.row),
    );
    tail = [...detExtraOrdered, ...llmOrdered];
  } else {
    const pool = [...detExtraIndexed, ...llmIndexed].map((entry) => ({
      row: entry.row,
      index: entry.index,
      weight: intentMergeWeight(entry.row.intent, weights),
    }));
    pool.sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return a.index - b.index;
    });
    tail = pool.map((entry) => entry.row);
  }

  const maxPool = Math.max(0, queryCount - detFloor.length);
  const combined = [...detFloor, ...tail.slice(0, maxPool)];
  return combined.map((row, i) => ({
    text: row.text,
    source: row.source,
    intent: row.intent,
    rank: i + 1,
    ...(row.persona !== undefined ? { persona: row.persona } : {}),
  }));
};
