import type { QueryDecision } from "@workspace/agent-data-api-contract";

import type { FinalizedQuery } from "../select/finalize";
import { normalizeQueryText } from "../probe/yield-probe";
import type { ProbedCandidate, ProbeSurvivor } from "../probe/yield-probe";

/**
 * Builds the per-query include/reject decision log for one query-analysis run.
 *
 * A query is `included` when its normalized text is in the finalized set. Survivors that did
 * not make the final cut were rejected over quota; dropped candidates were rejected for low
 * search yield, unless reinstated for a starved section (which puts them in the finalized set,
 * so they read as included).
 *
 * @param params - Probe survivors, dropped candidates, and the finalized (included) queries.
 * @returns One decision per generated query, survivors first.
 */
export const buildQueryDecisions = (params: {
  survivors: ProbeSurvivor[];
  dropped: ProbedCandidate[];
  finalized: FinalizedQuery[];
}): QueryDecision[] => {
  const { survivors, dropped, finalized } = params;
  const includedTexts = new Set(
    finalized.map((query) => normalizeQueryText(query.text)),
  );

  const decisions: QueryDecision[] = [];

  for (const survivor of survivors) {
    const included = includedTexts.has(normalizeQueryText(survivor.text));
    decisions.push({
      text: survivor.text,
      included,
      reason: included
        ? `included — ${survivor.hits} search hits`
        : "rejected — not selected (over quota)",
    });
  }

  for (const candidate of dropped) {
    const included = includedTexts.has(normalizeQueryText(candidate.text));
    decisions.push({
      text: candidate.text,
      included,
      reason: included
        ? "included — reinstated for a starved section"
        : `rejected — ${candidate.hits} search hits (below minimum)`,
    });
  }

  return decisions;
};
