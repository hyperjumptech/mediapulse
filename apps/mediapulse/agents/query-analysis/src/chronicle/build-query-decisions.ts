import type { QueryDecision } from "@workspace/agent-data-api-contract";

import { normalizeQueryText } from "../pipeline/candidates";
import type { Candidate } from "../pipeline/types";
import type { FinalizedQuery } from "../select/finalize";

/**
 * Builds the per-query include/reject decision log for one query-analysis run.
 *
 * A query is `included` when its normalized text is in the finalized set. Generated candidates
 * that did not make the final cut were rejected over quota.
 *
 * @param params - Generated candidates and the finalized (included) queries.
 * @returns One decision per generated query.
 */
export const buildQueryDecisions = (params: {
  candidates: Candidate[];
  finalized: FinalizedQuery[];
}): QueryDecision[] => {
  const { candidates, finalized } = params;
  const includedTexts = new Set(
    finalized.map((query) => normalizeQueryText(query.text)),
  );

  return candidates.map((candidate) => {
    const included = includedTexts.has(normalizeQueryText(candidate.text));

    return {
      text: candidate.text,
      included,
      reason: included
        ? "included — selected for its section"
        : "rejected — not selected (over quota)",
    };
  });
};
