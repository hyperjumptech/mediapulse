import type {
  QueryAnalysisIntent,
  QueryAnalysisSource,
} from "@workspace/agent-data-api-contract";

import type { LANGUAGES } from "../constants";

/** Query phrasing language for a candidate. */
export type Language = (typeof LANGUAGES)[number];

/** A single query candidate before probing. */
export type Candidate = {
  text: string;
  intent: QueryAnalysisIntent;
  source: QueryAnalysisSource;
  language: Language;
};
