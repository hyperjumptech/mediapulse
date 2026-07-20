import { QUERY_ANALYSIS_INTENTS } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import { LANGUAGES } from "../constants";

/**
 * One search-query candidate as authored by the generation model.
 *
 * `intent` is validated against the contract intents, so a value outside the set fails
 * validation and is retried rather than being silently dropped after the fact.
 */
export const generatedCandidateSchema = z.object({
  intent: z.enum(QUERY_ANALYSIS_INTENTS),
  language: z.enum(LANGUAGES),
  text: z.string(),
});

export type GeneratedCandidate = z.infer<typeof generatedCandidateSchema>;
