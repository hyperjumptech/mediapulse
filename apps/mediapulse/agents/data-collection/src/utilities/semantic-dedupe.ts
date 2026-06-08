import {
  DATA_COLLECTION_FINGERPRINT_HEAD_CHARS,
  type SourceFingerprint,
} from "@workspace/agent-data-api-contract";

import { cosineSimilarity } from "./embeddings";
import type { FetchedWebSearchResult } from "@workspace/agent-ingestion";

/** Candidate page that survived pre-persistence gates. */
export type SemanticDedupeCandidate = FetchedWebSearchResult;

export type SemanticDedupeDrop = {
  candidate: SemanticDedupeCandidate;
  matchedExistingId: string;
  similarity: number;
};

export type SemanticDedupeResult = {
  kept: SemanticDedupeCandidate[];
  dropped: SemanticDedupeDrop[];
};

export type SemanticEmbedder = (texts: string[]) => Promise<number[][]>;

/**
 * Builds embeddable text from a candidate title and body head.
 *
 * @param title - Page title.
 * @param content - Full page body.
 */
export const candidateFingerprintText = (
  title: string,
  content: string,
): string =>
  `${title}\n${content.slice(0, DATA_COLLECTION_FINGERPRINT_HEAD_CHARS)}`;

/**
 * Builds embeddable text from an existing corpus fingerprint.
 *
 * @param fingerprint - Server-returned fingerprint row.
 */
export const existingFingerprintText = (
  fingerprint: SourceFingerprint,
): string => `${fingerprint.title}\n${fingerprint.headSnippet}`;

/**
 * Returns the highest cosine similarity between a vector and corpus fingerprint vectors.
 *
 * @param vector - Candidate embedding.
 * @param corpusEmbeddings - Parallel corpus vectors and ids.
 */
const maxCorpusSimilarity = (
  vector: number[],
  corpusEmbeddings: Array<{ id: string; vector: number[] }>,
): { id: string; similarity: number } | null => {
  let best: { id: string; similarity: number } | null = null;

  for (const entry of corpusEmbeddings) {
    const similarity = cosineSimilarity(vector, entry.vector);
    if (!best || similarity > best.similarity) {
      best = { id: entry.id, similarity };
    }
  }

  return best;
};

/**
 * Drops candidates whose embedding exceeds `threshold` cosine similarity vs the existing corpus.
 *
 * @param candidates - Pages to persist after URL and content gates.
 * @param existingFingerprints - Recent corpus fingerprints from the Agent Data API.
 * @param options - Similarity threshold and batched embedder.
 */
export async function dedupeAgainstCorpus(
  candidates: readonly SemanticDedupeCandidate[],
  existingFingerprints: readonly SourceFingerprint[],
  options: { threshold: number; embedder: SemanticEmbedder },
): Promise<SemanticDedupeResult> {
  if (candidates.length === 0) {
    return { kept: [], dropped: [] };
  }

  if (existingFingerprints.length === 0) {
    return { kept: [...candidates], dropped: [] };
  }

  const candidateTexts = candidates.map((candidate) =>
    candidateFingerprintText(candidate.title, candidate.content),
  );
  const corpusTexts = existingFingerprints.map(existingFingerprintText);
  const embeddings = await options.embedder([
    ...candidateTexts,
    ...corpusTexts,
  ]);

  const candidateEmbeddings = embeddings.slice(0, candidates.length);
  const corpusEmbeddings = existingFingerprints.map((fingerprint, index) => ({
    id: fingerprint.id,
    vector: embeddings[candidates.length + index] ?? [],
  }));

  const kept: SemanticDedupeCandidate[] = [];
  const dropped: SemanticDedupeDrop[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    const vector = candidateEmbeddings[index] ?? [];
    const bestMatch = maxCorpusSimilarity(vector, corpusEmbeddings);

    if (bestMatch && bestMatch.similarity > options.threshold) {
      dropped.push({
        candidate,
        matchedExistingId: bestMatch.id,
        similarity: bestMatch.similarity,
      });
      continue;
    }

    kept.push(candidate);
  }

  return { kept, dropped };
}
