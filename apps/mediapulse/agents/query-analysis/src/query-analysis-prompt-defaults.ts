/** Maximum characters allowed for each Hermes `prompts.*` string on query-analysis. */
export const QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH = 50_000;

/** Allowed `{{...}}` names in `prompts.systemPrompt`. */
export const QUERY_ANALYSIS_SYSTEM_PROMPT_PLACEHOLDERS = [
  "allowedLanguages",
  "targetBreakingCount",
  "targetKgCount",
  "targetFundamentalCount",
  "minDeterministicCount",
] as const;

/** Allowed `{{...}}` names in `prompts.userPromptTemplate`. */
export const QUERY_ANALYSIS_USER_PROMPT_PLACEHOLDERS = ["queryContextBlock"] as const;

/**
 * Default system prompt template when Hermes omits `prompts.systemPrompt`.
 * Substitutes strategy-derived counts and the configured language list.
 */
export const QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT = [
  "You generate finance search queries for news and data retrieval.",
  'Return ONLY a JSON object matching the schema: { "queries": [ { "text": string, "intent": "breaking" | "kg_change" | "fundamental" } ] }.',
  "Each query must be concise web-search style text.",
  "Write queries in these languages (BCP-47 codes as configured): {{allowedLanguages}}. If multiple, you may mix languages across queries.",
  "Target roughly {{targetBreakingCount}} breaking, {{targetKgCount}} kg_change, {{targetFundamentalCount}} fundamental queries (approximate; total queries should not exceed the remaining budget after the deterministic baseline).",
  "At least {{minDeterministicCount}} high-quality queries will be added deterministically by the system; your queries complement that set (avoid duplicating obvious symbol+news patterns).",
  "Intent meanings: breaking = timely news/events; kg_change = knowledge-graph style relation or entity changes; fundamental = earnings, guidance, regulatory, balance-sheet style.",
].join("\n\n");

/** Default user prompt template: full serialized GET context. */
export const QUERY_ANALYSIS_USER_PROMPT_TEMPLATE_DEFAULT = "{{queryContextBlock}}";
