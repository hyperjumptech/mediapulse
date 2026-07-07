import { z } from "zod";

import { GENERATION_CANDIDATE_MAX, LANGUAGES } from "../constants";

/**
 * Intents the LLM candidate-generation call may emit — matches the coverage of the
 * deterministic template stages it replaces (own-company, competitor, regulator, industry
 * themes). Deliberately narrower than the full `QUERY_ANALYSIS_INTENTS` contract enum.
 */
export const GENERATION_INTENTS = [
  "breaking",
  "deals",
  "competitor",
  "regulatory",
  "industry_trend",
  "technology_trend",
  "macro",
  "wildcard",
] as const;

export type GenerationIntent = (typeof GENERATION_INTENTS)[number];

const generatedCandidateSchema = z.object({
  text: z.string().trim().min(1),
  intent: z.enum(GENERATION_INTENTS),
  language: z.enum(LANGUAGES),
});

/** Model output schema for one candidate-generation call. */
export const candidateGenerationResultSchema = z.object({
  candidates: z
    .array(generatedCandidateSchema)
    .min(1)
    .max(GENERATION_CANDIDATE_MAX),
});

export type GeneratedCandidate = z.infer<typeof generatedCandidateSchema>;
export type CandidateGenerationResult = z.infer<
  typeof candidateGenerationResultSchema
>;
