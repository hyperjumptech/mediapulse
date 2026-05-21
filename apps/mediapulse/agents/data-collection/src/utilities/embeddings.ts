import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";

/** Default OpenAI embedding model for semantic source dedupe. */
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

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
  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
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
 * Embeds short texts in a single batched OpenAI request.
 *
 * @param texts - Strings to embed.
 * @param params - API key and optional embedding model id.
 * @param deps - Injectable `embedMany` (default: production `embedMany` from `ai`).
 * @returns Parallel embedding vectors (empty when `texts` is empty; no API call).
 */
export const embedTexts = async (
  texts: string[],
  params: { apiKey: string; model?: string },
  deps: { embedManyFn?: EmbedManyFn } = {},
): Promise<number[][]> => {
  if (texts.length === 0) {
    return [];
  }
  const embedManyFn = deps.embedManyFn ?? embedMany;
  const openai = createOpenAI({ apiKey: params.apiKey });
  const { embeddings } = await embedManyFn({
    model: openai.embedding(params.model ?? DEFAULT_EMBEDDING_MODEL),
    values: texts,
  });
  return embeddings;
};
