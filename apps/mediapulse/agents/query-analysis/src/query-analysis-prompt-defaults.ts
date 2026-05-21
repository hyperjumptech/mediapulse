import {
  QUERY_ANALYSIS_INTENTS,
  type QueryAnalysisIntent,
} from "@workspace/agent-data-api-contract";

/** Maximum characters allowed for each Hermes `prompts.*` string on query-analysis. */
export const QUERY_ANALYSIS_LLM_PROMPT_FIELD_MAX_LENGTH = 50_000;

/** System prompt placeholder for each intent's approximate target count. */
export const QUERY_ANALYSIS_INTENT_TARGET_PLACEHOLDERS: Record<
  QueryAnalysisIntent,
  string
> = {
  breaking: "targetBreakingCount",
  kg_change: "targetKgCount",
  fundamental: "targetFundamentalCount",
  sentiment: "targetSentimentCount",
  competitor: "targetCompetitorCount",
  supply_chain: "targetSupplyChainCount",
  esg: "targetEsgCount",
  macro: "targetMacroCount",
  technical: "targetTechnicalCount",
};

/** Allowed `{{...}}` names in `prompts.systemPrompt`. */
export const QUERY_ANALYSIS_SYSTEM_PROMPT_PLACEHOLDERS = [
  "allowedLanguages",
  "minDeterministicCount",
  ...QUERY_ANALYSIS_INTENTS.map(
    (intent) => QUERY_ANALYSIS_INTENT_TARGET_PLACEHOLDERS[intent],
  ),
] as const;

/** Allowed `{{...}}` names in `prompts.userPromptTemplate`. */
export const QUERY_ANALYSIS_USER_PROMPT_PLACEHOLDERS = [
  "queryContextBlock",
] as const;

const QUERY_ANALYSIS_INTENT_JSON_UNION = QUERY_ANALYSIS_INTENTS.map(
  (intent) => `"${intent}"`,
).join(" | ");

/**
 * Default system prompt template when Hermes omits `prompts.systemPrompt`.
 * Substitutes strategy-derived counts and the configured language list.
 */
export const QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT = [
  "You generate finance search queries for news and data retrieval.",
  `Return ONLY a JSON object matching the schema: { "queries": [ { "text": string, "intent": ${QUERY_ANALYSIS_INTENT_JSON_UNION} } ] }.`,
  "Each query must be concise web-search style text.",
  "Write queries in these languages (BCP-47 codes as configured): {{allowedLanguages}}. If multiple, you may mix languages across queries.",
  [
    "Target approximate intent counts (total queries should not exceed the remaining budget after the deterministic baseline):",
    `- breaking: {{targetBreakingCount}}`,
    `- kg_change: {{targetKgCount}}`,
    `- fundamental: {{targetFundamentalCount}}`,
    `- sentiment: {{targetSentimentCount}}`,
    `- competitor: {{targetCompetitorCount}}`,
    `- supply_chain: {{targetSupplyChainCount}}`,
    `- esg: {{targetEsgCount}}`,
    `- macro: {{targetMacroCount}}`,
    `- technical: {{targetTechnicalCount}}`,
  ].join("\n"),
  "At least {{minDeterministicCount}} high-quality queries will be added deterministically by the system; your queries complement that set (avoid duplicating obvious symbol+news patterns).",
  [
    "Intent meanings:",
    "- breaking: timely news, catalysts, and price-moving events",
    "- kg_change: knowledge-graph relation or entity changes",
    "- fundamental: earnings, guidance, regulatory filings, balance-sheet style",
    "- sentiment: social buzz, analyst tone, retail chatter, reputation swings",
    "- competitor: peer positioning, share shifts, competitive threats",
    "- supply_chain: suppliers, logistics, input costs, production bottlenecks",
    "- esg: environmental, social, governance risks and controversies",
    "- macro: rates, FX, commodity, geopolitical, and sector-wide drivers",
    "- technical: chart patterns, momentum, support/resistance, volume signals",
  ].join("\n"),
].join("\n\n");

/** Default user prompt template: full serialized GET context. */
export const QUERY_ANALYSIS_USER_PROMPT_TEMPLATE_DEFAULT =
  "{{queryContextBlock}}";
