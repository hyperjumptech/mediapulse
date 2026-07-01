import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";

/** Default OpenAI embedding model for semantic query deduplication. */
export const DEFAULT_QUERY_EMBEDDING_MODEL = "text-embedding-3-small";

export type EmbedManyFn = typeof embedMany;

/**
 * Computes cosine similarity between two embedding vectors.
 *
 * @param a - First embedding vector.
 * @param b - Second embedding vector (same dimension as `a`).
 * @returns Cosine similarity in [-1, 1], or 0 when either vector has zero magnitude.
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Returns the maximum cosine similarity between `vector` and any vector in `accepted`.
 *
 * @param vector - Candidate embedding.
 * @param accepted - Embeddings already accepted as anchors or prior rows.
 * @returns Highest similarity score, or 0 when `accepted` is empty.
 */
export const maxCosineSimilarity = (
  vector: number[],
  accepted: number[][],
): number => {
  let max = 0;
  for (const anchor of accepted) {
    const similarity = cosineSimilarity(vector, anchor);
    if (similarity > max) {
      max = similarity;
    }
  }
  return max;
};

/**
 * Embeds query strings in a single batched OpenAI request.
 *
 * @param texts - Non-empty query strings to embed (deduped by caller when batching a run).
 * @param params - API key and optional embedding model id.
 * @param deps - Injectable `embedMany` (default: production `embedMany` from `ai`).
 * @returns Parallel embedding vectors (empty when `texts` is empty; no API call).
 */
export const embedQueries = async (
  texts: string[],
  params: {
    apiKey: string;
    model?: string;
    onUsage?: (usage: { totalTokens: number }) => void;
  },
  deps: { embedManyFn?: EmbedManyFn } = {},
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }
  const embedManyFn = deps.embedManyFn ?? embedMany;
  const openai = createOpenAI({ apiKey: params.apiKey });
  const { embeddings, usage } = await embedManyFn({
    model: openai.embedding(params.model ?? DEFAULT_QUERY_EMBEDDING_MODEL),
    values: texts,
  });
  const totalTokens = usage?.tokens;
  if (totalTokens !== undefined && params.onUsage !== undefined) {
    params.onUsage({ totalTokens });
  }

  return embeddings;
};

/**
 * Walks rows in input order, dropping any row whose embedding exceeds `threshold`
 * cosine similarity to an already-accepted row. The first `anchorCount` rows are
 * anchors: they are always accepted and never dropped.
 *
 * @param rows - Candidate rows aligned with `embeddings`.
 * @param embeddings - Parallel embedding vectors (same length as `rows`).
 * @param threshold - Maximum allowed cosine similarity vs accepted rows.
 * @param anchorCount - Prefix length treated as anchors (never dropped).
 * @returns Filtered rows preserving input order among survivors.
 */
export const dedupeBySimilarity = <T extends { text: string }>(
  rows: T[],
  embeddings: number[][],
  threshold: number,
  anchorCount: number,
): T[] => {
  const accepted: T[] = [];
  const acceptedEmbeddings: number[][] = [];
  const effectiveAnchors = Math.min(anchorCount, rows.length);

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    const embedding = embeddings[index] ?? [];
    if (index < effectiveAnchors) {
      accepted.push(row);
      acceptedEmbeddings.push(embedding);
      continue;
    }
    if (maxCosineSimilarity(embedding, acceptedEmbeddings) > threshold) {
      continue;
    }
    accepted.push(row);
    acceptedEmbeddings.push(embedding);
  }

  return accepted;
};

/**
 * Collects unique trimmed query texts for a single batched embedding call per run.
 *
 * @param deterministic - Deterministic template rows.
 * @param llm - LLM candidate rows.
 * @returns De-duplicated trimmed texts in deterministic-first order.
 */
export const collectQueryTextsForEmbedding = (
  deterministic: Array<{ text: string }>,
  llm: Array<{ text: string }>,
): string[] => {
  const seen = new Set<string>();
  const texts: string[] = [];
  const add = (raw: string): void => {
    const text = raw.trim();
    if (text.length === 0 || seen.has(text)) {
      return;
    }
    seen.add(text);
    texts.push(text);
  };
  for (const row of deterministic) {
    add(row.text);
  }
  for (const row of llm) {
    add(row.text);
  }
  return texts;
};

/**
 * Builds a trimmed-text → embedding lookup from parallel arrays.
 *
 * @param texts - Query strings passed to {@link embedQueries}.
 * @param embeddings - Vectors returned in the same order as `texts`.
 * @returns Map keyed by trimmed query text.
 */
export const buildEmbeddingByText = (
  texts: string[],
  embeddings: number[][],
): Map<string, number[]> => {
  const map = new Map<string, number[]>();
  for (let index = 0; index < texts.length; index++) {
    map.set(texts[index]!, embeddings[index] ?? []);
  }
  return map;
};

/** Precomputed embeddings injected into merge for semantic LLM deduplication. */
export type QuerySemanticEmbedder = {
  threshold: number;
  embeddingByText: ReadonlyMap<string, number[]>;
};

/**
 * Builds the embedder dependency from one batched embedding response.
 *
 * @param texts - Texts embedded in the batched call.
 * @param embeddings - Vectors from {@link embedQueries}.
 * @param threshold - Cosine similarity cutoff.
 * @returns Embedder for {@link mergeQueryCandidates}.
 */
export const buildQuerySemanticEmbedder = (
  texts: string[],
  embeddings: number[][],
  threshold: number,
): QuerySemanticEmbedder => ({
  threshold,
  embeddingByText: buildEmbeddingByText(texts, embeddings),
});
