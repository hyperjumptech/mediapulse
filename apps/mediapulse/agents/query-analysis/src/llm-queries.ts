import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { ModelMessage } from "ai";
import {
  queryAnalysisIntentSchema,
  type GetQueryAnalysisResponse,
  type QueryAnalysisIntent,
} from "@workspace/agent-data-api-contract";
import { z } from "zod";

/** Zod schema for structured LLM output (validated by AI SDK). */
export const llmQueriesOutputSchema = z.object({
  queries: z.array(
    z.object({
      text: z.string(),
      intent: queryAnalysisIntentSchema,
    }),
  ),
});

export type LlmQueryStrategyPrompt = {
  queryCount: number;
  allowedLanguages: string[];
  minDeterministicCount: number;
  weights: {
    breaking: number;
    kgChange: number;
    fundamental: number;
  };
};

/**
 * Builds the system prompt describing JSON shape, intent mix targets, languages, and strategy knobs.
 *
 * @param strategy - Counts, languages, deterministic floor, and relative intent weights.
 * @returns System message content for the chat model.
 */
export const buildQueryAnalysisSystemContent = (
  strategy: LlmQueryStrategyPrompt,
): string => {
  const sum =
    strategy.weights.breaking +
    strategy.weights.kgChange +
    strategy.weights.fundamental;
  const ratioBreaking = sum > 0 ? strategy.weights.breaking / sum : 1 / 3;
  const ratioKg = sum > 0 ? strategy.weights.kgChange / sum : 1 / 3;
  const ratioFund = sum > 0 ? strategy.weights.fundamental / sum : 1 / 3;
  const langList = strategy.allowedLanguages.join(", ");
  return [
    "You generate finance search queries for news and data retrieval.",
    'Return ONLY a JSON object matching the schema: { "queries": [ { "text": string, "intent": "breaking" | "kg_change" | "fundamental" } ] }.',
    "Each query must be concise web-search style text.",
    `Write queries in these languages (BCP-47 codes as configured): ${langList}. If multiple, you may mix languages across queries.`,
    `Target roughly ${Math.round(ratioBreaking * strategy.queryCount)} breaking, ${Math.round(ratioKg * strategy.queryCount)} kg_change, ${Math.round(ratioFund * strategy.queryCount)} fundamental queries (approximate; total queries should not exceed the remaining budget after the deterministic baseline).`,
    `At least ${strategy.minDeterministicCount} high-quality queries will be added deterministically by the system; your queries complement that set (avoid duplicating obvious symbol+news patterns).`,
    "Intent meanings: breaking = timely news/events; kg_change = knowledge-graph style relation or entity changes; fundamental = earnings, guidance, regulatory, balance-sheet style.",
  ].join("\n");
};

/**
 * Serializes GET /query-analysis context for the user message (ticker, entities, themes, relation deltas).
 *
 * @param context - Typed agent-data-api GET payload.
 * @returns Multi-line string for the user message.
 */
export const buildQueryAnalysisUserContent = (
  context: GetQueryAnalysisResponse,
): string => {
  const lines: string[] = [
    `Ticker symbol: ${context.ticker.symbol}`,
    `Company name: ${context.ticker.name}`,
  ];
  if (context.topEntities.length > 0) {
    lines.push("Top entities:");
    for (const e of context.topEntities) {
      lines.push(
        `- ${e.canonicalName} (${e.typeName}) relevance=${e.relevanceWeight}`,
      );
    }
  }
  if (context.recentThemes.length > 0) {
    lines.push("Recent themes:");
    for (const t of context.recentThemes) {
      lines.push(`- ${t.theme} (articles: ${t.articleCount})`);
    }
  }
  const deltas = context.recentRelationDeltas ?? [];
  if (deltas.length > 0) {
    lines.push("Recent relation deltas:");
    for (const d of deltas) {
      lines.push(
        `- ${d.fromEntity} → ${d.toEntity} [${d.relationType}] ${d.change}`,
      );
    }
  }
  return lines.join("\n");
};

export type GenerateObjectForQueries = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmQueriesOutputSchema;
  maxOutputTokens: number;
  messages: ModelMessage[];
}) => Promise<{ object: z.infer<typeof llmQueriesOutputSchema> }>;

/**
 * Calls the chat model with structured output; returns trimmed non-empty candidates with intents.
 * Throws on transport, API, or schema validation errors (caller handles fallback).
 *
 * @param params - API key, model id, token budget, and chat messages.
 * @param deps - Injectable `generateObject` (default: production `generateObject` from `ai`).
 * @returns LLM candidate rows (may be empty if the model returns only empty strings).
 */
export const fetchLlmQueryCandidates = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    messages: ModelMessage[];
  },
  deps: { generateObjectForQueries: GenerateObjectForQueries } = {
    generateObjectForQueries: generateObject,
  },
): Promise<Array<{ text: string; intent: QueryAnalysisIntent }>> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const { object } = await deps.generateObjectForQueries({
    model: openai(params.model),
    schema: llmQueriesOutputSchema,
    maxOutputTokens: params.maxOutputTokens,
    messages: params.messages,
  });
  return (object.queries ?? [])
    .map((q) => ({ text: q.text.trim(), intent: q.intent }))
    .filter((q) => q.text.length > 0);
};
