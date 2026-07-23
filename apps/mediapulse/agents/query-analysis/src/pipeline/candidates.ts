import type { Candidate } from "./types";

/** Normalizes a query text for dedupe (lowercase, collapse whitespace). */
export const normalizeQueryText = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

/** Dedupes candidates by normalized text, keeping the first occurrence. */
export const dedupeCandidates = (candidates: Candidate[]): Candidate[] => {
  const seen = new Set<string>();
  const deduped: Candidate[] = [];
  for (const candidate of candidates) {
    const key = normalizeQueryText(candidate.text);
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
};
