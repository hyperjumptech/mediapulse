import type { ProvenQuery } from "@workspace/agent-data-api-contract";

import { isPerishableQuery } from "./perishable";
import type { Candidate, Language } from "./types";

const INDONESIAN_MARKERS =
  /\b(?:dan|di|ke|dari|yang|untuk|dengan|pada|harga|saham|kinerja|pertumbuhan|kebijakan|pasar|laba|industri)\b/iu;

const languageOf = (text: string): Language =>
  INDONESIAN_MARKERS.test(text) ? "id" : "en";

/**
 * Turns queries that already produced novel articles into candidates for the next set.
 *
 * Query sets are regenerated every run, so a phrasing that worked is otherwise discarded and has to
 * be reinvented. Seeding the pool with proven phrasings ahead of freshly generated ones lets
 * `finalizeQueries` keep them, which is what makes the yield history worth recording.
 *
 * - Important: a proven query that has since become perishable is dropped rather than carried
 *   forward. It earned its yield when its date was current and will not earn it again.
 *
 * @param proven - Proven queries from agent-data-api, strongest first.
 * @returns Candidates in the same order, ready to lead the generated pool.
 */
export const provenCandidates = (proven: readonly ProvenQuery[]): Candidate[] =>
  proven
    .filter((query) => !isPerishableQuery(query.text))
    .map((query) => ({
      text: query.text,
      intent: query.intent,
      language: languageOf(query.text),
    }));
