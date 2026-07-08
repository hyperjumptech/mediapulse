import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import { LANGUAGES } from "../constants";

export const GENERATION_INTENT_LABELS = [
  "earnings",
  "corporate_actions",
  "governance_legal",
  "company_news",
  "competitor",
  "input_costs",
  "demand",
  "regulatory",
  "industry_trend",
  "disruption",
  "macro",
] as const;

export type GenerationIntentLabel = (typeof GENERATION_INTENT_LABELS)[number];

const QUERY_ANALYSIS_INTENT_BY_GENERATION_INTENT: Record<
  GenerationIntentLabel,
  QueryAnalysisIntent
> = {
  earnings: "fundamental",
  corporate_actions: "deals",
  governance_legal: "breaking",
  company_news: "breaking",
  competitor: "competitor",
  input_costs: "supply_chain",
  demand: "macro",
  regulatory: "regulatory",
  industry_trend: "industry_trend",
  disruption: "technology_trend",
  macro: "macro",
};

export const queryAnalysisIntentForNumber = (
  intentNumber: number,
): QueryAnalysisIntent | null => {
  const label = GENERATION_INTENT_LABELS[intentNumber - 1];
  return label ? QUERY_ANALYSIS_INTENT_BY_GENERATION_INTENT[label] : null;
};

export const generatedCandidateSchema = z.object({
  i: z.number().int(),
  l: z.enum(LANGUAGES),
  s: z.string(),
});

export type GeneratedCandidate = z.infer<typeof generatedCandidateSchema>;
