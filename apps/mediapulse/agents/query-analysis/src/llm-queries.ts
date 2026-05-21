import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
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

import {
  formatExemplarAssistantContent,
  selectFewShotExemplars,
} from "./exemplars/default-exemplars";

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

/** System instruction for the free-form brainstorm pass. */
const BRAINSTORM_SYSTEM_PROMPT = [
  "You are a financial research analyst brainstorming search angles.",
  "List 12–20 distinct angles a savvy analyst would search for about the company below.",
  "Write free prose as plain bullet points — one angle per line.",
  "Do not output JSON, intent labels, or numbered schema fields.",
].join("\n");

/**
 * Builds the system and user messages for the brainstorm pass.
 *
 * @param strategy - Strategy knobs (languages inform phrasing expectations).
 * @param context - Live GET /query-analysis payload.
 * @returns System and user content for `generateText`.
 */
export const buildBrainstormPrompt = (
  strategy: LlmQueryStrategyPrompt,
  context: GetQueryAnalysisResponse,
): { system: string; user: string } => ({
  system: [
    BRAINSTORM_SYSTEM_PROMPT,
    `Write angles in these languages when natural: ${strategy.allowedLanguages.join(", ")}.`,
  ].join("\n\n"),
  user: buildQueryAnalysisUserContent(context),
});

/**
 * Parses brainstorm model output into trimmed bullet strings.
 *
 * @param text - Raw `generateText` output.
 * @returns Non-empty bullet lines with common list prefixes stripped.
 */
export const parseBrainstormBullets = (text: string): string[] => {
  const bullets: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine
      .trim()
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (line.length > 0) {
      bullets.push(line);
    }
  }
  return bullets;
};

/**
 * Appends brainstorm refinement instructions to the structured-call user content.
 *
 * @param userContent - Serialized live context for the target ticker.
 * @param brainstormBullets - Angles from the brainstorm pass.
 * @returns User message content for the structured JSON call.
 */
export const buildStructuredUserContentWithBrainstorm = (
  userContent: string,
  brainstormBullets: string[],
): string => {
  const bulletBlock = brainstormBullets
    .map((bullet) => `- ${bullet}`)
    .join("\n");
  return [
    userContent,
    "",
    "Here are angles you previously brainstormed:",
    bulletBlock,
    "",
    "Now refine, dedupe, and label each with an intent in the JSON response.",
  ].join("\n");
};

/**
 * Builds chat messages for the structured query-generation call.
 *
 * @param options - System/user content, optional few-shot exemplars, brainstorm bullets.
 * @returns Message array for `generateObject`.
 */
export const buildStructuredQueryMessages = (options: {
  systemContent: string;
  userContent: string;
  fewShotExemplarCount: number;
  brainstormBullets?: string[];
}): ModelMessage[] => {
  const messages: ModelMessage[] = [
    {
      role: "system",
      content: options.brainstormBullets?.length
        ? `${options.systemContent}\n\nRefine the brainstormed angles into the final JSON query list. Dedupe near-duplicates before assigning intents.`
        : options.systemContent,
    },
  ];

  for (const exemplar of selectFewShotExemplars(options.fewShotExemplarCount)) {
    messages.push({ role: "user", content: exemplar.context });
    messages.push({
      role: "assistant",
      content: formatExemplarAssistantContent(exemplar.queries),
    });
  }

  const finalUserContent =
    options.brainstormBullets && options.brainstormBullets.length > 0
      ? buildStructuredUserContentWithBrainstorm(
          options.userContent,
          options.brainstormBullets,
        )
      : options.userContent;

  messages.push({ role: "user", content: finalUserContent });
  return messages;
};

export type LlmQuerySampling = {
  temperature: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed?: number;
};

export type GenerateObjectForQueries = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmQueriesOutputSchema;
  maxOutputTokens: number;
  messages: ModelMessage[];
  temperature: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed?: number;
}) => Promise<{ object: z.infer<typeof llmQueriesOutputSchema> }>;

export type GenerateTextForBrainstorm = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  messages: ModelMessage[];
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed?: number;
}) => Promise<{ text: string }>;

/**
 * Runs the free-form brainstorm pass and returns parsed bullet angles.
 *
 * @param params - API key, model, token budget, strategy, context, and sampling.
 * @param deps - Injectable `generateText` (default: production `generateText` from `ai`).
 * @returns Trimmed bullet strings from model output.
 */
export const fetchBrainstormBullets = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    strategy: LlmQueryStrategyPrompt;
    context: GetQueryAnalysisResponse;
    sampling: LlmQuerySampling;
  },
  deps: { generateTextForBrainstorm: GenerateTextForBrainstorm } = {
    generateTextForBrainstorm: generateText,
  },
): Promise<string[]> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const { system, user } = buildBrainstormPrompt(
    params.strategy,
    params.context,
  );
  const { sampling } = params;
  const { text } = await deps.generateTextForBrainstorm({
    model: openai(params.model),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxOutputTokens: params.maxOutputTokens,
    temperature: sampling.temperature,
    topP: sampling.topP,
    presencePenalty: sampling.presencePenalty,
    frequencyPenalty: sampling.frequencyPenalty,
    ...(sampling.seed !== undefined ? { seed: sampling.seed } : {}),
  });
  return parseBrainstormBullets(text);
};

/**
 * Calls the chat model with structured output; returns trimmed non-empty candidates with intents.
 * Throws on transport, API, or schema validation errors (caller handles fallback).
 *
 * @param params - API key, model id, token budget, chat messages, and sampling knobs.
 * @param deps - Injectable `generateObject` (default: production `generateObject` from `ai`).
 * @returns LLM candidate rows (may be empty if the model returns only empty strings).
 */
export const fetchLlmQueryCandidates = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    messages: ModelMessage[];
    sampling: LlmQuerySampling;
  },
  deps: { generateObjectForQueries: GenerateObjectForQueries } = {
    generateObjectForQueries: generateObject,
  },
): Promise<Array<{ text: string; intent: QueryAnalysisIntent }>> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const { sampling } = params;
  const { object } = await deps.generateObjectForQueries({
    model: openai(params.model),
    schema: llmQueriesOutputSchema,
    maxOutputTokens: params.maxOutputTokens,
    messages: params.messages,
    temperature: sampling.temperature,
    topP: sampling.topP,
    presencePenalty: sampling.presencePenalty,
    frequencyPenalty: sampling.frequencyPenalty,
    ...(sampling.seed !== undefined ? { seed: sampling.seed } : {}),
  });
  return (object.queries ?? [])
    .map((q) => ({ text: q.text.trim(), intent: q.intent }))
    .filter((q) => q.text.length > 0);
};

/** Parameters for the full query-analysis LLM path (optional brainstorm + structured call). */
export type FetchQueryAnalysisLlmCandidatesParams = {
  apiKey: string;
  model: string;
  brainstormModel: string;
  maxOutputTokens: number;
  systemContent: string;
  userContent: string;
  context: GetQueryAnalysisResponse;
  strategy: LlmQueryStrategyPrompt;
  sampling: LlmQuerySampling;
  useBrainstormPass: boolean;
  fewShotExemplarCount: number;
};

/**
 * Fetches LLM query candidates, optionally running a brainstorm pass first.
 *
 * @param params - Full LLM path configuration from Hermes invoke config.
 * @param deps - Injectable brainstorm and structured-output collaborators.
 * @returns Trimmed LLM candidate rows with intents.
 */
export const fetchQueryAnalysisLlmCandidates = async (
  params: FetchQueryAnalysisLlmCandidatesParams,
  deps: {
    fetchBrainstormBullets?: typeof fetchBrainstormBullets;
    fetchLlmQueryCandidates?: typeof fetchLlmQueryCandidates;
  } = {},
): Promise<Array<{ text: string; intent: QueryAnalysisIntent }>> => {
  const runBrainstorm = deps.fetchBrainstormBullets ?? fetchBrainstormBullets;
  const runStructured = deps.fetchLlmQueryCandidates ?? fetchLlmQueryCandidates;

  let brainstormBullets: string[] | undefined;
  if (params.useBrainstormPass) {
    brainstormBullets = await runBrainstorm({
      apiKey: params.apiKey,
      model: params.brainstormModel,
      maxOutputTokens: params.maxOutputTokens,
      strategy: params.strategy,
      context: params.context,
      sampling: params.sampling,
    });
  }

  const messages = buildStructuredQueryMessages({
    systemContent: params.systemContent,
    userContent: params.userContent,
    fewShotExemplarCount: params.fewShotExemplarCount,
    brainstormBullets,
  });

  return runStructured({
    apiKey: params.apiKey,
    model: params.model,
    maxOutputTokens: params.maxOutputTokens,
    messages,
    sampling: params.sampling,
  });
};
