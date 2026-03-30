/**
 * Merges deterministic and LLM candidate queries, deduplicates, scores, and assigns ranks.
 */

export type QuerySource = "deterministic" | "llm";
export type QueryIntent = "breaking" | "kg_change" | "fundamental";

export interface RawCandidate {
  text: string;
  source: QuerySource;
  intent: QueryIntent;
}

export interface RankedQuery extends RawCandidate {
  rank: number;
}

export interface RankWeights {
  breaking: number;
  kg_change: number;
  fundamental: number;
}

const normalise = (text: string): string => text.toLowerCase().trim();

/**
 * Merges, deduplicates, scores, trims to `queryCount`, and assigns 1-based ranks.
 *
 * Scoring: intentWeight × (deterministic ? 1.1 : 1.0) so the baseline is preferred
 * when score is otherwise equal.
 *
 * @param candidates - Raw candidates from deterministic and LLM generators.
 * @param config - Target count and per-intent weights.
 * @returns Ranked and trimmed query list.
 */
export function rankAndTrim(
  candidates: RawCandidate[],
  config: { queryCount: number; weights: RankWeights },
): RankedQuery[] {
  const { queryCount, weights } = config;

  // 1. Deduplicate: first occurrence wins
  const seen = new Set<string>();
  const unique: RawCandidate[] = [];
  for (const c of candidates) {
    const key = normalise(c.text);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }

  // 2. Score
  const score = (c: RawCandidate): number => {
    const intentWeight = weights[c.intent];
    const sourceBonus = c.source === "deterministic" ? 1.1 : 1.0;
    return intentWeight * sourceBonus;
  };

  // 3. Sort descending by score
  const sorted = [...unique].sort((a, b) => score(b) - score(a));

  // 4. Trim to queryCount
  const trimmed = sorted.slice(0, queryCount);

  // 5. Assign 1-based ranks
  return trimmed.map((c, i) => ({ ...c, rank: i + 1 }));
}
