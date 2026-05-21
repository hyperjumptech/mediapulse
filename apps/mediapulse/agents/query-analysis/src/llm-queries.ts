import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { ModelMessage } from "ai";
import {
  queryAnalysisIntentSchema,
  type GetQueryAnalysisResponse,
  type QueryAnalysisIntent,
} from "@workspace/agent-data-api-contract";
import { z } from "zod";

import {
  QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT,
  QUERY_ANALYSIS_USER_PROMPT_TEMPLATE_DEFAULT,
} from "./query-analysis-prompt-defaults";
import { substituteLlmPromptTemplate } from "@workspace/agent-llm-prompt-template";

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
 * Builds replacement map for the default query-analysis system prompt template.
 *
 * @param strategy - Counts, languages, deterministic floor, and relative intent weights.
 * @returns String values for each supported `{{token}}` in the system template.
 */
export const buildQueryAnalysisSystemTemplateReplacements = (
  strategy: LlmQueryStrategyPrompt,
): Record<string, string> => {
  const sum =
    strategy.weights.breaking +
    strategy.weights.kgChange +
    strategy.weights.fundamental;
  const ratioBreaking = sum > 0 ? strategy.weights.breaking / sum : 1 / 3;
  const ratioKg = sum > 0 ? strategy.weights.kgChange / sum : 1 / 3;
  const ratioFund = sum > 0 ? strategy.weights.fundamental / sum : 1 / 3;
  return {
    allowedLanguages: strategy.allowedLanguages.join(", "),
    targetBreakingCount: String(
      Math.round(ratioBreaking * strategy.queryCount),
    ),
    targetKgCount: String(Math.round(ratioKg * strategy.queryCount)),
    targetFundamentalCount: String(Math.round(ratioFund * strategy.queryCount)),
    minDeterministicCount: String(strategy.minDeterministicCount),
  };
};

/**
 * Resolves the query-analysis system prompt (Hermes override or built-in default template).
 *
 * @param configuredSystemPrompt - Optional `prompts.systemPrompt` from Hermes.
 * @param strategy - Strategy knobs used to fill template placeholders.
 * @returns System message content for the chat model.
 */
export const resolveQueryAnalysisSystemContent = (
  configuredSystemPrompt: string | undefined,
  strategy: LlmQueryStrategyPrompt,
): string => {
  const template =
    configuredSystemPrompt ?? QUERY_ANALYSIS_SYSTEM_PROMPT_TEMPLATE_DEFAULT;
  return substituteLlmPromptTemplate(
    template,
    buildQueryAnalysisSystemTemplateReplacements(strategy),
  );
};

/**
 * Resolves the query-analysis user prompt (Hermes override or built-in default template).
 *
 * @param configuredUserPromptTemplate - Optional `prompts.userPromptTemplate` from Hermes.
 * @param context - Serialized GET /query-analysis context for `{{queryContextBlock}}`.
 * @returns User message content for the chat model.
 */
export const resolveQueryAnalysisUserContent = (
  configuredUserPromptTemplate: string | undefined,
  context: GetQueryAnalysisResponse,
): string => {
  const template =
    configuredUserPromptTemplate ?? QUERY_ANALYSIS_USER_PROMPT_TEMPLATE_DEFAULT;
  return substituteLlmPromptTemplate(template, {
    queryContextBlock: buildQueryAnalysisUserContent(context),
  });
};

/**
 * Builds the system prompt describing JSON shape, intent mix targets, languages, and strategy knobs.
 *
 * @param strategy - Counts, languages, deterministic floor, and relative intent weights.
 * @returns System message content for the chat model.
 */
export const buildQueryAnalysisSystemContent = (
  strategy: LlmQueryStrategyPrompt,
): string => resolveQueryAnalysisSystemContent(undefined, strategy);

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
  if (context.peers.length > 0) {
    lines.push("Sector peers:");
    for (const peer of context.peers) {
      lines.push(`- ${peer.symbol} (${peer.name}) relevance=${peer.relevance}`);
    }
  }
  const calendar = context.calendar;
  if (calendar.nextEarningsAt || calendar.recentEventTypes.length > 0) {
    lines.push("Calendar:");
    if (calendar.nextEarningsAt) {
      lines.push(`- Next earnings: ${calendar.nextEarningsAt}`);
    }
    if (calendar.recentEventTypes.length > 0) {
      lines.push(`- Recent events: ${calendar.recentEventTypes.join(", ")}`);
    }
  }
  if (context.headlineSamples.length > 0) {
    lines.push("Recent headlines:");
    for (const headline of context.headlineSamples) {
      const publishedDate = headline.publishedAt.slice(0, 10);
      lines.push(
        `- ${publishedDate} (${headline.sourceName}) — "${headline.title}"`,
      );
    }
  }
  if (context.kgNeighborhood.length > 0) {
    lines.push("KG neighborhood:");
    for (const edge of context.kgNeighborhood) {
      lines.push(
        `- ${edge.fromEntity} --${edge.relationType}--> ${edge.toEntity}`,
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
