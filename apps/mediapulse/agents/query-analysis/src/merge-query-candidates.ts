import type { QueryAnalysisConfigSnapshot } from "@workspace/agent-data-api-contract";

import { normalizeQueryTextKey } from "./normalize-query-text.js";
import type { QueryCandidate } from "./deterministic-baseline.js";

const intentPriority: Record<QueryCandidate["intent"], number> = {
  breaking: 0,
  kg_change: 1,
  fundamental: 2,
};

/**
 * Merges deterministic and LLM candidates, dedupes by normalized text (deterministic wins ties), sorts by intent priority and configured weights, then caps to the target set size.
 *
 * @param baseline - Deterministic rows (always win on duplicate text with LLM).
 * @param llmRows - Optional LLM rows (skipped when text collides with baseline).
 * @param config - Global weights and target `queryCount`.
 * @returns Final ordered list with `rank` 0..n-1 suitable for POST /query-analysis.
 */
export const mergeAndRankCandidates = (
  baseline: QueryCandidate[],
  llmRows: QueryCandidate[],
  config: QueryAnalysisConfigSnapshot,
): QueryCandidate[] => {
  const weightFor = (intent: QueryCandidate["intent"]): number => {
    if (intent === "breaking") {
      return config.weightBreaking;
    }
    if (intent === "kg_change") {
      return config.weightKgChange;
    }
    return config.weightFundamental;
  };

  const byKey = new Map<string, QueryCandidate>();

  for (const row of baseline) {
    const key = normalizeQueryTextKey(row.text);
    if (key.length === 0) {
      continue;
    }
    byKey.set(key, { ...row });
  }

  for (const row of llmRows) {
    const key = normalizeQueryTextKey(row.text);
    if (key.length === 0 || byKey.has(key)) {
      continue;
    }
    byKey.set(key, { ...row });
  }

  const combined = [...byKey.values()].sort((a, b) => {
    const ia = intentPriority[a.intent];
    const ib = intentPriority[b.intent];
    if (ia !== ib) {
      return ia - ib;
    }
    const wa = weightFor(a.intent);
    const wb = weightFor(b.intent);
    if (wa !== wb) {
      return wb - wa;
    }
    if (a.source !== b.source) {
      return a.source === "deterministic" ? -1 : 1;
    }
    return a.text.localeCompare(b.text);
  });

  const capped = combined.slice(0, config.queryCount);
  return capped.map((row, index) => ({ ...row, rank: index }));
};
