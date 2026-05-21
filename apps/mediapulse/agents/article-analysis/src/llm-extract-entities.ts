import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, type ModelMessage } from "ai";
import type { GetAnalysisResponse } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import {
  ARTICLE_ANALYSIS_EXTRACTION_SYSTEM_PROMPT_TEMPLATE_DEFAULT,
  ARTICLE_ANALYSIS_EXTRACTION_USER_PROMPT_TEMPLATE_DEFAULT,
  formatArticleAnalysisEntityTypesBlock,
  formatArticleAnalysisRelationTypesBlock,
} from "./article-extraction-prompt-defaults.js";
import type { ResolvedExemplar } from "./exemplars/default-extraction-exemplars.js";
import { substituteLlmPromptTemplate } from "@workspace/agent-llm-prompt-template";

const sentimentSchema = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);

export const llmExtractionOpenAiWireSchema = z.object({
  entities: z.array(
    z.object({
      canonicalName: z.string().trim().min(1),
      typeId: z.string().uuid(),
      description: z.string().max(4000),
      aliases: z.array(z.string().trim().min(1)),
    }),
  ),
  relations: z.array(
    z.object({
      fromEntityName: z.string().trim().min(1),
      toEntityName: z.string().trim().min(1),
      relationTypeId: z.string().uuid(),
    }),
  ),
  articleMentions: z.array(
    z.object({
      entityName: z.string().trim().min(1),
      mentionCount: z.number().int().positive(),
      confidence: z.number().min(0).max(1),
      sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "NONE"]),
    }),
  ),
});

export type LlmExtractionWireOutput = z.infer<
  typeof llmExtractionOpenAiWireSchema
>;

/** Structured extraction result after normalizing wire values (null = absent). */
export const llmExtractionOutputSchema = z.object({
  entities: z.array(
    z.object({
      canonicalName: z.string().trim().min(1),
      typeId: z.string().uuid(),
      description: z.string().nullable(),
      aliases: z.array(z.string().trim().min(1)),
    }),
  ),
  relations: z.array(
    z.object({
      fromEntityName: z.string().trim().min(1),
      toEntityName: z.string().trim().min(1),
      relationTypeId: z.string().uuid(),
    }),
  ),
  articleMentions: z.array(
    z.object({
      entityName: z.string().trim().min(1),
      mentionCount: z.number().int().positive(),
      confidence: z.number().min(0).max(1),
      sentiment: sentimentSchema.nullable(),
    }),
  ),
});

export type LlmExtractionOutput = z.infer<typeof llmExtractionOutputSchema>;

/** In-memory contract for brainstorm sections passed into the structured pass. */
export type ArticleBrainstorm = {
  keyPlayers: string[];
  events: string[];
  relationships: string[];
  sentimentNotes: string[];
};

export type ArticleBrainstormCallResult = {
  text: string;
  usage: LlmExtractionUsage | null;
};

export type GenerateTextForBrainstorm = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  maxOutputTokens: number;
  messages: ModelMessage[];
}) => Promise<ArticleBrainstormCallResult>;

/**
 * Maps OpenAI wire payload to the normalized extraction shape (null = none).
 *
 * @param wire - Parsed output from {@link llmExtractionOpenAiWireSchema}.
 * @returns Validated normalized object for downstream pipeline code.
 */
export const normalizeLlmExtractionWire = (
  wire: LlmExtractionWireOutput,
): LlmExtractionOutput =>
  llmExtractionOutputSchema.parse({
    entities: wire.entities.map((e) => ({
      ...e,
      description: e.description.trim() === "" ? null : e.description.trim(),
    })),
    relations: wire.relations,
    articleMentions: wire.articleMentions.map((m) => ({
      ...m,
      sentiment: m.sentiment === "NONE" ? null : m.sentiment,
    })),
  });

/** Normalized token counts from the AI SDK (`generateObject` usage), if the provider reports them. */
export type LlmExtractionUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LlmExtractionCallResult = {
  object: LlmExtractionOutput;
  usage: LlmExtractionUsage | null;
};

export type GenerateObjectForExtraction = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmExtractionOpenAiWireSchema;
  maxOutputTokens: number;
  messages: ModelMessage[];
}) => Promise<{
  object: LlmExtractionWireOutput;
  usage: LlmExtractionUsage | null;
}>;

/**
 * Converts AI SDK `LanguageModelUsage` into compact counters; `null` when the provider omits usage.
 *
 * @param usage - Raw usage from `generateObject`.
 * @returns Numeric triple or null when no token fields are present.
 */
export const normalizeLlmUsageFromSdk = (usage: {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
}): LlmExtractionUsage | null => {
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  const totalTokens = usage.totalTokens;
  if (inputTokens == null && outputTokens == null && totalTokens == null) {
    return null;
  }
  const inTok = inputTokens ?? 0;
  const outTok = outputTokens ?? 0;
  return {
    inputTokens: inTok,
    outputTokens: outTok,
    totalTokens: totalTokens ?? inTok + outTok,
  };
};

const defaultGenerateObjectForExtraction: GenerateObjectForExtraction = async (
  args,
) => {
  const result = await generateObject(args);
  return {
    object: result.object,
    usage: normalizeLlmUsageFromSdk(result.usage),
  };
};

const defaultGenerateTextForBrainstorm: GenerateTextForBrainstorm = async (
  args,
) => {
  const result = await generateText(args);
  return {
    text: result.text,
    usage: normalizeLlmUsageFromSdk(result.usage),
  };
};

const BRAINSTORM_SYSTEM_PROMPT = [
  "You are an equity analyst reading ONE article.",
  "List the article's contents in four short bullet sections:",
  "KEY PLAYERS (named entities the article discusses),",
  "EVENTS (things that happened — earnings, lawsuits, deals),",
  "RELATIONSHIPS (who-did-what-to-whom in plain prose),",
  "SENTIMENT NOTES (tone signals, hedge words, certainty markers).",
  "4–7 bullets per section.",
  "Use the company's own words where natural.",
  "Plain text only, no JSON.",
].join(" ");

const BRAINSTORM_FOLLOW_UP_PREFIX = [
  "Here are your prior notes on this article.",
  "Now produce the structured extraction — refine, dedupe, and assign each entity an entityTypeId from the vocabulary above.",
].join(" ");

/**
 * Resolves the extraction system prompt after merging Hermes `prompts.systemPrompt` with code defaults.
 *
 * @param configuredSystemPrompt - Optional override from Hermes agent config.
 * @param ctx - Vocabulary from analysis GET.
 * @returns System message string (no article body, no secrets).
 */
export const resolveArticleAnalysisExtractionSystemContent = (
  configuredSystemPrompt: string | undefined,
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
): string => {
  const template =
    configuredSystemPrompt ??
    ARTICLE_ANALYSIS_EXTRACTION_SYSTEM_PROMPT_TEMPLATE_DEFAULT;
  return substituteLlmPromptTemplate(template, {
    entityTypesBlock: formatArticleAnalysisEntityTypesBlock(ctx),
    relationTypesBlock: formatArticleAnalysisRelationTypesBlock(ctx),
  });
};

/**
 * Resolves the extraction user prompt after merging Hermes `prompts.userPromptTemplate` with code defaults.
 *
 * @param configuredUserPromptTemplate - Optional override from Hermes agent config.
 * @param args - Ticker, title, truncated body (already capped for token budget).
 * @returns User message string.
 */
export const resolveArticleAnalysisExtractionUserContent = (
  configuredUserPromptTemplate: string | undefined,
  args: {
    tickerId: string;
    title: string;
    contentTruncated: string;
  },
): string => {
  const template =
    configuredUserPromptTemplate ??
    ARTICLE_ANALYSIS_EXTRACTION_USER_PROMPT_TEMPLATE_DEFAULT;
  return substituteLlmPromptTemplate(template, {
    tickerId: args.tickerId,
    title: args.title,
    articleContent: args.contentTruncated,
  });
};

/**
 * System prompt listing allowed entity and relation type UUIDs from analysis GET (package defaults only).
 *
 * @param ctx - Vocabulary from analysis GET.
 * @returns System message string (no article body, no secrets).
 */
export const buildExtractionSystemContent = (
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
): string => resolveArticleAnalysisExtractionSystemContent(undefined, ctx);

/**
 * User message with ticker metadata and truncated article text (package defaults only).
 *
 * @param args - Ticker, title, truncated body (already capped for token budget).
 * @returns User message string.
 */
export const buildExtractionUserContent = (args: {
  tickerId: string;
  title: string;
  contentTruncated: string;
}): string => resolveArticleAnalysisExtractionUserContent(undefined, args);

/**
 * Returns the brainstorm-pass system prompt (plain-text enumeration, no JSON schema).
 *
 * @param _ctx - Reserved for future host-specific brainstorm guidance.
 */
export const buildBrainstormSystemContent = (
  _ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
): string => BRAINSTORM_SYSTEM_PROMPT;

/**
 * Builds the brainstorm user message using the same title and body block as extraction.
 *
 * @param args - Ticker, title, and truncated article body.
 */
export const buildBrainstormUserContent = (args: {
  tickerId: string;
  title: string;
  contentTruncated: string;
}): string => buildExtractionUserContent(args);

/**
 * Formats brainstorm plain text as the structured pass follow-up user turn.
 *
 * @param brainstormText - Free-form brainstorm output from the first pass.
 */
export const buildBrainstormFollowUpUserContent = (
  brainstormText: string,
): string => `${BRAINSTORM_FOLLOW_UP_PREFIX}\n\n${brainstormText}`;

/**
 * Parses brainstorm plain text into the in-memory {@link ArticleBrainstorm} contract.
 *
 * @param text - Raw brainstorm model output.
 */
export const parseArticleBrainstormText = (text: string): ArticleBrainstorm => {
  const sections: ArticleBrainstorm = {
    keyPlayers: [],
    events: [],
    relationships: [],
    sentimentNotes: [],
  };

  const sectionMatchers: Array<{
    key: keyof ArticleBrainstorm;
    labels: string[];
  }> = [
    { key: "keyPlayers", labels: ["KEY PLAYERS", "KEY PLAYERS:"] },
    { key: "events", labels: ["EVENTS", "EVENTS:"] },
    { key: "relationships", labels: ["RELATIONSHIPS", "RELATIONSHIPS:"] },
    { key: "sentimentNotes", labels: ["SENTIMENT NOTES", "SENTIMENT NOTES:"] },
  ];

  const lines = text.split("\n");
  let currentKey: keyof ArticleBrainstorm | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const matchedSection = sectionMatchers.find((section) =>
      section.labels.some(
        (label) => line.toUpperCase() === label || line.toUpperCase().startsWith(`${label} `),
      ),
    );
    if (matchedSection) {
      currentKey = matchedSection.key;
      continue;
    }

    if (currentKey === null) {
      continue;
    }

    const bullet = line.replace(/^[-*•]\s*/, "").trim();
    if (bullet.length > 0) {
      sections[currentKey].push(bullet);
    }
  }

  return sections;
};

/**
 * Runs the free-form brainstorm pass for one article via `generateText`.
 *
 * @param params - API key, model, token limit, and chat messages.
 * @param deps - Injectable `generateText` wrapper (tests swap mock).
 */
export const fetchArticleBrainstorm = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    messages: ModelMessage[];
  },
  deps: { generateTextForBrainstorm: GenerateTextForBrainstorm } = {
    generateTextForBrainstorm: defaultGenerateTextForBrainstorm,
  },
): Promise<ArticleBrainstormCallResult> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  return deps.generateTextForBrainstorm({
    model: openai(params.model),
    maxOutputTokens: params.maxOutputTokens,
    messages: params.messages,
  });
};

/**
 * Formats one few-shot exemplar snippet as a user turn.
 *
 * @param articleSnippet - Curated article excerpt for the exemplar.
 */
const formatExemplarUserContent = (articleSnippet: string): string =>
  `Example article:\n\n${articleSnippet}`;

/**
 * Builds chat messages for extraction, optionally injecting few-shot exemplar turns.
 *
 * @param systemContent - Resolved system prompt.
 * @param userContent - Resolved real-article user prompt.
 * @param exemplars - Resolved few-shot exemplars to inject before the real user turn.
 * @param brainstormText - Optional brainstorm notes appended as a follow-up user turn.
 */
export const buildExtractionModelMessages = (
  systemContent: string,
  userContent: string,
  exemplars: readonly ResolvedExemplar[] = [],
  brainstormText?: string,
): ModelMessage[] => {
  const messages: ModelMessage[] = [{ role: "system", content: systemContent }];

  for (const exemplar of exemplars) {
    messages.push({
      role: "user",
      content: formatExemplarUserContent(exemplar.articleSnippet),
    });
    messages.push({
      role: "assistant",
      content: JSON.stringify(exemplar.expectedOutput, null, 2),
    });
  }

  messages.push({ role: "user", content: userContent });

  if (brainstormText !== undefined && brainstormText.trim().length > 0) {
    messages.push({
      role: "user",
      content: buildBrainstormFollowUpUserContent(brainstormText),
    });
  }

  return messages;
};

/**
 * Runs structured extraction for one data source via `generateObject`.
 *
 * @param params - API key, model, token limit, chat messages, optional few-shot exemplars and brainstorm notes.
 * @param deps - Injectable `generateObject` wrapper (tests swap mock).
 * @returns Parsed entities and relations plus optional tokenizer usage.
 */
export const extractEntitiesAndRelationsForSource = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    messages: ModelMessage[];
    exemplars?: readonly ResolvedExemplar[];
    brainstormText?: string;
  },
  deps: { generateObjectForExtraction: GenerateObjectForExtraction } = {
    generateObjectForExtraction: defaultGenerateObjectForExtraction,
  },
): Promise<LlmExtractionCallResult> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const systemContent = String(params.messages[0]?.content ?? "");
  const userContent = String(params.messages.at(-1)?.content ?? "");
  const shouldBuildMessages =
    (params.exemplars !== undefined && params.exemplars.length > 0) ||
    (params.brainstormText !== undefined && params.brainstormText.trim().length > 0);
  const messages = shouldBuildMessages
    ? buildExtractionModelMessages(
        systemContent,
        userContent,
        params.exemplars ?? [],
        params.brainstormText,
      )
    : params.messages;
  const raw = await deps.generateObjectForExtraction({
    model: openai(params.model),
    schema: llmExtractionOpenAiWireSchema,
    maxOutputTokens: params.maxOutputTokens,
    messages,
  });
  return {
    object: normalizeLlmExtractionWire(raw.object),
    usage: raw.usage,
  };
};
