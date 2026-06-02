import type { GetAnalysisResponse } from "@workspace/agent-data-api-contract";

/**
 * System prompt for the vocabulary-repair `generateObject` pass.
 * Must include `{{entityTypesBlock}}` and `{{relationTypesBlock}}`.
 */
export const ARTICLE_ANALYSIS_REPAIR_SYSTEM_PROMPT_TEMPLATE_DEFAULT = [
  "Each item below was rejected because its typeId or relationTypeId was not in the allowed vocabulary.",
  "Re-label each row using ONLY the UUIDs listed under ENTITY TYPES and RELATION TYPES.",
  "Keep every canonicalName, fromEntityName, and toEntityName string unchanged — only rewrite typeId and relationTypeId.",
  "Return JSON with keys entities and relations (arrays; either may be empty).",
  "ENTITY TYPES (uuid — label):\n{{entityTypesBlock}}",
  "RELATION TYPES (uuid — label):\n{{relationTypesBlock}}",
].join("\n\n");

/**
 * Extraction system prompt template (in-code default).
 * Must include `{{entityTypesBlock}}` and `{{relationTypesBlock}}`.
 */
export const ARTICLE_ANALYSIS_EXTRACTION_SYSTEM_PROMPT_TEMPLATE_DEFAULT = [
  "You extract knowledge-graph entities and relations from ONE article for industry analysis.",
  "Always include one COMPANY entity representing the issuer (the ticker company). Use tickerSymbol and tickerName from the user message; include tickerSymbol as an alias on that entity.",
  "Use ONLY entity typeId values listed under ENTITY TYPES and ONLY relationTypeId values under RELATION TYPES.",
  "Relation fromEntityName and toEntityName must match canonicalName strings of entities you output (not aliases).",
  "Prefer high-precision entities; omit uncertain extractions.",
  'Every entity must include description as a string; use an empty string "" when there is no short description.',
  "Every entity must include aliases as an array (use [] when there are no aliases beyond canonicalName).",
  "Also populate articleMentions: for entities in your entities array that appear in the article text, estimate mentionCount (positive integer), confidence (0–1), and sentiment POSITIVE | NEGATIVE | NEUTRAL, or NONE when not applicable.",
  "Each articleMentions.entityName must exactly match the canonicalName of one row in your entities array (same spelling as canonicalName).",
  "Return JSON object with keys entities, relations, and articleMentions (arrays; articleMentions may be empty).",
  "ENTITY TYPES (uuid — label):\n{{entityTypesBlock}}",
  "RELATION TYPES (uuid — label):\n{{relationTypesBlock}}",
].join("\n\n");

/**
 * Extraction user prompt template (in-code default).
 */
export const ARTICLE_ANALYSIS_EXTRACTION_USER_PROMPT_TEMPLATE_DEFAULT = [
  "tickerId: {{tickerId}}",
  "tickerSymbol: {{tickerSymbol}}",
  "tickerName: {{tickerName}}",
  "title: {{title}}",
  "article:",
  "{{articleContent}}",
].join("\n\n");

/**
 * Builds the entity-type lines block inserted into the default system template.
 *
 * @param ctx - Analysis GET vocabulary slice.
 * @returns Multi-line block (uuid — label per line).
 */
export const formatArticleAnalysisEntityTypesBlock = (
  ctx: Pick<GetAnalysisResponse, "entityTypes">,
): string => ctx.entityTypes.map((e) => `- ${e.id} — ${e.name}`).join("\n");

/**
 * Builds the relation-type lines block inserted into the default system template.
 *
 * @param ctx - Analysis GET vocabulary slice.
 * @returns Multi-line block (uuid — label per line).
 */
export const formatArticleAnalysisRelationTypesBlock = (
  ctx: Pick<GetAnalysisResponse, "relationTypes">,
): string => ctx.relationTypes.map((r) => `- ${r.id} — ${r.name}`).join("\n");
