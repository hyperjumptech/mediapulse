import type {
  NewsletterSectionId,
  QueryAnalysisIntent,
  QueryAnalysisPriorYield,
} from "@workspace/agent-data-api-contract";
import {
  NEWSLETTER_SECTION_IDS,
  SECTION_BY_INTENT,
} from "@workspace/agent-data-api-contract";

import type { QuerySemanticEmbedder } from "./embeddings";
import { maxCosineSimilarity } from "./embeddings";

/** One deterministic seed row before merge. */
export type DeterministicCandidate = {
  text: string;
  intent: QueryAnalysisIntent;
  /** BCP-47 language tag when produced by a language slice (observability). */
  language?: string;
};

/** One LLM row after validation (trimmed text, intent per model output). */
export type LlmCandidate = {
  text: string;
  intent: QueryAnalysisIntent;
  /** Persona id when produced by multi-persona fan-out (observability only). */
  persona?: string;
  /** BCP-47 language tag when produced by a language slice (observability). */
  language?: string;
};

/** Row persisted via agent-data-api `queryAnalysis.create`. */
export type MergedQueryRow = {
  text: string;
  source: "deterministic" | "llm";
  intent: QueryAnalysisIntent;
  rank: number;
  /** Persona id for LLM rows from multi-persona fan-out (observability only). */
  persona?: string;
  /** BCP-47 language tag for multilingual quota observability. */
  language?: string;
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
 * Computes a log-scaled novel-yield bonus multiplier for merge ordering.
 *
 * @param params - Intent and prior yield rollups.
 * @returns Multiplier ≥ 1 when yield data exists; 1 when absent.
 */
export const yieldMergeMultiplier = (params: {
  intent: QueryAnalysisIntent;
  priorYield?: QueryAnalysisPriorYield;
}): number => {
  const { priorYield, intent } = params;
  if (priorYield === undefined) {
    return 1;
  }
  const intentBucket = priorYield.perIntent.find(
    (row) => row.intent === intent,
  );
  if (intentBucket !== undefined) {
    return 1 + Math.log(1 + intentBucket.avgNovel);
  }
  return 1;
};

/**
 * Returns intent merge weight multiplied by optional prior-yield bonus.
 *
 * @param params - Intent, weights, and prior yield rollups.
 * @returns Effective merge weight for sorting.
 */
export const effectiveMergeWeight = (params: {
  intent: QueryAnalysisIntent;
  weights: QueryMergeWeights;
  priorYield?: QueryAnalysisPriorYield;
}): number =>
  intentMergeWeight(params.intent, params.weights) *
  yieldMergeMultiplier({
    intent: params.intent,
    priorYield: params.priorYield,
  });

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
    out.push({
      text,
      intent: row.intent,
      ...(row.language !== undefined ? { language: row.language } : {}),
    });
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
      ...(row.language !== undefined ? { language: row.language } : {}),
    });
  }
  return out;
};

/**
 * Dedupes wildcard rows against existing keys while preserving reserved slot count.
 * When collisions drop rows, optionally retries once via `retryFetch`.
 *
 * @param params - Wildcard batch, occupied keys, slot budget, and optional retry fetcher.
 * @returns Accepted wildcard rows (length ≤ `wildcardCount`) tagged as `source: "llm"`.
 */
export const finalizeWildcardCandidates = async (params: {
  wildcards: LlmCandidate[];
  seenKeys: Set<string>;
  wildcardCount: number;
  retryFetch?: (avoidTexts: string[]) => Promise<LlmCandidate[]>;
}): Promise<
  Array<{
    text: string;
    intent: QueryAnalysisIntent;
    source: "llm";
  }>
> => {
  const acceptFromBatch = (
    batch: LlmCandidate[],
    accepted: Array<{
      text: string;
      intent: QueryAnalysisIntent;
      source: "llm";
    }>,
  ): number => {
    let dropped = 0;
    for (const row of batch) {
      if (accepted.length >= params.wildcardCount) {
        break;
      }
      const text = row.text.trim();
      if (text.length === 0) {
        continue;
      }
      const key = normalizeQueryKey(text);
      if (params.seenKeys.has(key)) {
        dropped += 1;
        continue;
      }
      params.seenKeys.add(key);
      accepted.push({
        text,
        intent: row.intent,
        source: "llm",
      });
    }
    return dropped;
  };

  const accepted: Array<{
    text: string;
    intent: QueryAnalysisIntent;
    source: "llm";
  }> = [];
  const dropped = acceptFromBatch(params.wildcards, accepted);

  if (
    params.retryFetch !== undefined &&
    accepted.length < params.wildcardCount &&
    (dropped > 0 || params.wildcards.length < params.wildcardCount)
  ) {
    const avoidTexts = [
      ...params.wildcards.map((row) => row.text.trim()).filter(Boolean),
      ...accepted.map((row) => row.text),
    ];
    const retryCount = params.wildcardCount - accepted.length;
    const replacements = await params.retryFetch(avoidTexts);
    acceptFromBatch(replacements.slice(0, retryCount), accepted);
  }

  return accepted;
};

/**
 * Appends wildcard rows to a merged set and reassigns contiguous ranks up to `queryCount`.
 *
 * @param merged - Standard pipeline rows from {@link mergeQueryCandidates}.
 * @param wildcardRows - Reserved-slot wildcard rows.
 * @param queryCount - Total rows to persist in the active query set.
 * @returns Combined rows with updated ranks (length ≤ `queryCount`).
 */
export const appendWildcardRowsToMerged = (
  merged: MergedQueryRow[],
  wildcardRows: Array<{
    text: string;
    intent: QueryAnalysisIntent;
    source: "llm";
  }>,
  queryCount: number,
): MergedQueryRow[] => {
  const combined = [...merged];
  for (const row of wildcardRows) {
    if (combined.length >= queryCount) {
      break;
    }
    combined.push({
      text: row.text,
      source: row.source,
      intent: row.intent,
      rank: combined.length + 1,
    });
  }
  return combined.map((row, index) => ({ ...row, rank: index + 1 }));
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
      ...(row.language !== undefined ? { language: row.language } : {}),
    });
  }

  return out;
};

type PoolRow = {
  text: string;
  intent: QueryAnalysisIntent;
  source: "deterministic" | "llm";
  persona?: string;
  language?: string;
};

/**
 * Sorts pool rows by intent merge weight with stable tie-breaking on input index.
 *
 * @param rows - Candidate rows with original indices.
 * @param weights - Relative intent weights from strategy snapshot.
 * @param priorYield - Optional rolling yield rollups for log-scaled bonuses.
 * @returns Rows ordered by descending weight.
 */
export const sortPoolByIntentWeight = (
  rows: Array<{ row: PoolRow; index: number }>,
  weights: QueryMergeWeights,
  priorYield?: QueryAnalysisPriorYield,
): PoolRow[] => {
  const pool = rows.map((entry) => ({
    ...entry,
    weight: effectiveMergeWeight({
      intent: entry.row.intent,
      weights,
      priorYield,
    }),
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
 * Post-merge section-coverage reserve pass.
 *
 * For each newsletter section that has a dedicated intent (via SECTION_BY_INTENT), if the
 * merged set contains zero queries mapping to that section, this function promotes the
 * highest-scored deterministic candidate of a matching intent. It displaces the
 * lowest-ranked query of the most over-represented intent so the total count stays at
 * `queryCount`. Sections without a dedicated intent are unaffected; the caller is
 * responsible for any keyword guidance those sections require (e.g. via LLM system prompt).
 *
 * @param merged - Ranked output of {@link mergeQueryCandidates}.
 * @param deterministic - Full deterministic candidate pool for the run (pre-merge).
 * @param queryCount - Target total row count; output length will not exceed this.
 * @returns Adjusted rows with contiguous ranks reassigned.
 */
export const applySectionCoverageReserve = (
  merged: MergedQueryRow[],
  deterministic: DeterministicCandidate[],
  queryCount: number,
): MergedQueryRow[] => {
  // Build intent -> section mapping for sections that have a dedicated intent.
  const intentToSection = new Map<string, string>();
  for (const sectionId of NEWSLETTER_SECTION_IDS) {
    for (const [intent, mappedSection] of Object.entries(SECTION_BY_INTENT)) {
      if (mappedSection === sectionId) {
        intentToSection.set(intent, sectionId);
      }
    }
  }

  // Collect the set of sections that have at least one dedicated intent.
  const sectionsWithIntent = new Set(
    Object.values(SECTION_BY_INTENT).filter(
      (sectionId): sectionId is NewsletterSectionId => sectionId !== null,
    ),
  );

  // Determine which dedicated-intent sections are currently uncovered.
  const coveredSections = new Set(
    merged
      .map((row) => SECTION_BY_INTENT[row.intent])
      .filter(
        (sectionId): sectionId is NewsletterSectionId => sectionId !== null,
      ),
  );
  const uncoveredSections = [...sectionsWithIntent].filter(
    (sectionId) => !coveredSections.has(sectionId),
  );

  if (uncoveredSections.length === 0) {
    return merged;
  }

  // Build a dedupe set from the merged rows for candidate lookup.
  const mergedKeys = new Set(merged.map((row) => normalizeQueryKey(row.text)));

  // For each uncovered section, find the first deterministic candidate that maps to it.
  // Deterministic candidates are already in pack order; the first match is the best-scored one.
  let adjusted = [...merged];

  for (const targetSection of uncoveredSections) {
    // Find intents that map to this section.
    const matchingIntents = new Set(
      Object.entries(SECTION_BY_INTENT)
        .filter(([, section]) => section === targetSection)
        .map(([intent]) => intent),
    );

    // Find the first deterministic candidate for those intents not already in the merged set.
    const candidate = deterministic.find(
      (row) =>
        matchingIntents.has(row.intent) &&
        !mergedKeys.has(normalizeQueryKey(row.text)),
    );

    if (candidate === undefined) {
      continue;
    }

    // Find the intent that is most over-represented among non-dedicated-section intents
    // (i.e. intents mapping to null), so displacing one of them costs the least coverage.
    // Fall back to the intent with the most rows overall when all intents are mapped.
    const intentCounts = new Map<string, number>();
    for (const row of adjusted) {
      intentCounts.set(row.intent, (intentCounts.get(row.intent) ?? 0) + 1);
    }

    // Prefer displacing from homeless intents (null-mapped) first.
    const homelessIntents = new Set(
      Object.entries(SECTION_BY_INTENT)
        .filter(([, section]) => section === null)
        .map(([intent]) => intent),
    );

    let victimIntent: string | undefined;
    let victimCount = 0;
    for (const [intent, count] of intentCounts) {
      if (homelessIntents.has(intent) && count > victimCount) {
        victimIntent = intent;
        victimCount = count;
      }
    }

    // If no homeless intent has rows, fall back to any intent with the most rows.
    if (victimIntent === undefined) {
      for (const [intent, count] of intentCounts) {
        if (count > victimCount) {
          victimIntent = intent;
          victimCount = count;
        }
      }
    }

    if (victimIntent === undefined) {
      continue;
    }

    // Find the lowest-ranked row with the victim intent (highest rank number = last in list).
    let victimIndex = -1;
    for (let rowIndex = adjusted.length - 1; rowIndex >= 0; rowIndex--) {
      if (adjusted[rowIndex]?.intent === victimIntent) {
        victimIndex = rowIndex;
        break;
      }
    }

    if (victimIndex === -1) {
      continue;
    }

    // Replace victim with the reserve candidate.
    adjusted[victimIndex] = {
      text: candidate.text,
      source: "deterministic",
      intent: candidate.intent,
      rank: adjusted[victimIndex]!.rank,
      ...(candidate.language !== undefined
        ? { language: candidate.language }
        : {}),
    };

    mergedKeys.add(normalizeQueryKey(candidate.text));
    coveredSections.add(targetSection);
  }

  return adjusted.slice(0, queryCount).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
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
  priorYield?: QueryAnalysisPriorYield;
}): MergedQueryRow[] => {
  const { queryCount, minDeterministicCount, weights, priorYield } = params;
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
    ...(row.language !== undefined ? { language: row.language } : {}),
  }));
  const detExtra: PoolRow[] = dedupedDet.slice(effectiveMin).map((row) => ({
    text: row.text,
    intent: row.intent,
    source: "deterministic" as const,
    ...(row.language !== undefined ? { language: row.language } : {}),
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
    const detExtraOrdered = sortPoolByIntentWeight(
      detExtraIndexed,
      weights,
      priorYield,
    );
    const llmOrdered = orderLlmRowsByPersonaRoundRobin(
      llmIndexed.map((entry) => entry.row),
    );
    tail = [...detExtraOrdered, ...llmOrdered];
  } else {
    const pool = [...detExtraIndexed, ...llmIndexed].map((entry) => ({
      row: entry.row,
      index: entry.index,
      weight: effectiveMergeWeight({
        intent: entry.row.intent,
        weights,
        priorYield,
      }),
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
    ...(row.language !== undefined ? { language: row.language } : {}),
  }));
};
