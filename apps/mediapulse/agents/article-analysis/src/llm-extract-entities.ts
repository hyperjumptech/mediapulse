import { createOpenAI } from "@ai-sdk/openai";
import {
  generateObject,
  generateText,
  APICallError,
  NoObjectGeneratedError,
  type ModelMessage,
} from "ai";
import {
  buildOpenAiReasoningProviderOptions,
  type OpenAiReasoningProviderOptions,
} from "@workspace/agent-runtime";
import type { GetAnalysisResponse } from "@workspace/agent-data-api-contract";
import { z } from "zod";

import type {
  BadEntityRecord,
  BadRelationRecord,
  EntityProposal,
  RelationProposal,
} from "./analysis-vocabulary.js";
import {
  ARTICLE_ANALYSIS_EXTRACTION_SYSTEM_PROMPT_TEMPLATE_DEFAULT,
  ARTICLE_ANALYSIS_EXTRACTION_USER_PROMPT_TEMPLATE_DEFAULT,
  ARTICLE_ANALYSIS_REPAIR_SYSTEM_PROMPT_TEMPLATE_DEFAULT,
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
  providerOptions?: OpenAiReasoningProviderOptions;
}) => Promise<ArticleBrainstormCallResult>;

/** Fine-grained sub-type for a `NoObjectGeneratedError` non-response. */
export type NoResponseSubtype =
  | "length_truncation"
  | "empty_stop"
  | "content_filter"
  | "other";

/**
 * Returns the fine-grained sub-type of a `NoObjectGeneratedError` non-response.
 *
 * Used by instrumentation and by budget-escalation retry to distinguish starvation
 * from genuinely empty completions.
 *
 * @param error - Thrown value from an LLM call.
 * @returns Sub-type label; `"other"` for non-`NoObjectGeneratedError` errors.
 */
export const classifyNoResponseSubtype = (
  error: unknown,
): NoResponseSubtype => {
  if (!NoObjectGeneratedError.isInstance(error)) {
    return "other";
  }
  const finishReason = error.finishReason;
  if (finishReason === "length") {
    return "length_truncation";
  }
  if (finishReason === "content-filter") {
    return "content_filter";
  }
  if (finishReason === "stop") {
    return "empty_stop";
  }
  const text = error.text;
  if (text === undefined || text.trim().length === 0) {
    return "empty_stop";
  }
  return "other";
};

/**
 * Classifies an LLM extraction error as transient or permanent.
 *
 * Transient errors are safe to retry (rate limits, empty completions, timeouts, 5xx).
 * Permanent errors should not be retried (parse failures, unknown categories).
 *
 * @param error - Thrown value from an LLM extraction call.
 * @returns Classification driving retry vs. immediate failure.
 */
export const classifyLlmExtractionError = (
  error: unknown,
): "transient" | "permanent" => {
  if (APICallError.isInstance(error)) {
    const statusCode = error.statusCode;
    if (
      error.isRetryable ||
      statusCode === 429 ||
      (statusCode !== undefined && statusCode >= 500 && statusCode <= 599)
    ) {
      return "transient";
    }
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    if (error.message.includes("the model did not return a response")) {
      return "transient";
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("timed out") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNRESET")
  ) {
    return "transient";
  }
  return "permanent";
};

/**
 * Runs an async LLM operation with transient-error retry and jittered exponential backoff.
 *
 * Delay formula: `random() * min(maxDelayMs, baseDelayMs * 2^attempt)` (full jitter).
 * Full jitter prevents concurrent extractions (plan 36) from retrying in lockstep.
 *
 * @param operation - Async LLM call to attempt.
 * @param deps - Retry limits, injectable sleep, classifier, and optional abort predicate.
 * @returns The fulfilled result from `operation`.
 * @throws The last error when retries are exhausted, classification is permanent, or shouldAbort fires.
 */
export const executeLlmCallWithTransientRetries = async <T>(
  operation: () => Promise<T>,
  deps: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    sleep: (ms: number) => Promise<void>;
    classify: (error: unknown) => "transient" | "permanent";
    onRetry?: (attempt: number, error: unknown) => void;
    shouldAbort?: () => boolean;
  },
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= deps.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const mayRetry =
        attempt < deps.maxRetries && deps.classify(error) === "transient";
      if (!mayRetry) {
        throw error;
      }
      deps.onRetry?.(attempt + 1, error);
      const exponentialCap = Math.min(
        deps.maxDelayMs,
        deps.baseDelayMs * 2 ** attempt,
      );
      const jitteredDelay = Math.random() * exponentialCap;
      if (deps.shouldAbort?.()) {
        throw error;
      }
      await deps.sleep(jitteredDelay);
    }
  }
  throw lastError;
};

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

/** Wire schema for the relation self-critique pass (`generateObject`). */
export const llmRelationCritiqueSchema = z.object({
  ratings: z.array(
    z.object({
      fromEntityName: z.string(),
      toEntityName: z.string(),
      relationTypeId: z.string().uuid(),
      textualSupport: z.number().min(1).max(5),
      correctnessOfType: z.number().min(1).max(5),
      novelty: z.number().min(1).max(5),
      drop: z.boolean(),
      evidenceSpan: z.string().max(280),
    }),
  ),
});

export type LlmRelationCritiqueWireOutput = z.infer<
  typeof llmRelationCritiqueSchema
>;

export type LlmRelationCritiqueRating =
  LlmRelationCritiqueWireOutput["ratings"][number];

export type RelationCritiqueCandidate =
  LlmExtractionOutput["relations"][number];

export type LlmRelationCritiqueCallResult = {
  ratings: LlmRelationCritiqueRating[];
  usage: LlmExtractionUsage | null;
};

export type GenerateObjectForRelationCritique = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmRelationCritiqueSchema;
  maxOutputTokens: number;
  messages: ModelMessage[];
  providerOptions?: OpenAiReasoningProviderOptions;
}) => Promise<{
  object: LlmRelationCritiqueWireOutput;
  usage: LlmExtractionUsage | null;
}>;

export type GenerateObjectForExtraction = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmExtractionOpenAiWireSchema;
  maxOutputTokens: number;
  messages: ModelMessage[];
  providerOptions?: OpenAiReasoningProviderOptions;
}) => Promise<{
  object: LlmExtractionWireOutput;
  usage: LlmExtractionUsage | null;
}>;

/** Wire schema for the vocabulary-repair pass (`generateObject`). */
export const llmVocabularyRepairWireSchema = z.object({
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
});

export type LlmVocabularyRepairWireOutput = z.infer<
  typeof llmVocabularyRepairWireSchema
>;

export type LlmVocabularyRepairCallResult = {
  entities: EntityProposal[];
  relations: RelationProposal[];
  usage: LlmExtractionUsage | null;
};

export type GenerateObjectForVocabularyRepair = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmVocabularyRepairWireSchema;
  maxOutputTokens: number;
  messages: ModelMessage[];
  providerOptions?: OpenAiReasoningProviderOptions;
}) => Promise<{
  object: LlmVocabularyRepairWireOutput;
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
  const { providerOptions, ...rest } = args;
  const result = await generateObject({
    ...rest,
    ...(providerOptions !== undefined ? { providerOptions } : {}),
  });
  return {
    object: result.object,
    usage: normalizeLlmUsageFromSdk(result.usage),
  };
};

const defaultGenerateTextForBrainstorm: GenerateTextForBrainstorm = async (
  args,
) => {
  const { providerOptions, ...rest } = args;
  const result = await generateText({
    ...rest,
    ...(providerOptions !== undefined ? { providerOptions } : {}),
  });
  return {
    text: result.text,
    usage: normalizeLlmUsageFromSdk(result.usage),
  };
};

const defaultGenerateObjectForRelationCritique: GenerateObjectForRelationCritique =
  async (args) => {
    const { providerOptions, ...rest } = args;
    const result = await generateObject({
      ...rest,
      ...(providerOptions !== undefined ? { providerOptions } : {}),
    });
    return {
      object: result.object,
      usage: normalizeLlmUsageFromSdk(result.usage),
    };
  };

const defaultGenerateObjectForVocabularyRepair: GenerateObjectForVocabularyRepair =
  async (args) => {
    const { providerOptions, ...rest } = args;
    const result = await generateObject({
      ...rest,
      ...(providerOptions !== undefined ? { providerOptions } : {}),
    });
    return {
      object: result.object,
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
 * Builds the extraction system prompt from the in-code default template.
 *
 * @param ctx - Vocabulary from analysis GET.
 * @returns System message string (no article body, no secrets).
 */
export const buildArticleAnalysisExtractionSystemContent = (
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
): string =>
  substituteLlmPromptTemplate(
    ARTICLE_ANALYSIS_EXTRACTION_SYSTEM_PROMPT_TEMPLATE_DEFAULT,
    {
      entityTypesBlock: formatArticleAnalysisEntityTypesBlock(ctx),
      relationTypesBlock: formatArticleAnalysisRelationTypesBlock(ctx),
    },
  );

/**
 * Builds the extraction user prompt from the in-code default template.
 *
 * @param args - Ticker, title, truncated body (already capped for token budget).
 * @returns User message string.
 */
export const buildArticleAnalysisExtractionUserContent = (args: {
  tickerId: string;
  tickerSymbol: string;
  tickerName: string;
  title: string;
  contentTruncated: string;
}): string =>
  substituteLlmPromptTemplate(
    ARTICLE_ANALYSIS_EXTRACTION_USER_PROMPT_TEMPLATE_DEFAULT,
    {
      tickerId: args.tickerId,
      tickerSymbol: args.tickerSymbol,
      tickerName: args.tickerName,
      title: args.title,
      articleContent: args.contentTruncated,
    },
  );

/** @see {@link buildArticleAnalysisExtractionSystemContent} */
export const buildExtractionSystemContent =
  buildArticleAnalysisExtractionSystemContent;

/** @see {@link buildArticleAnalysisExtractionUserContent} */
export const buildExtractionUserContent =
  buildArticleAnalysisExtractionUserContent;

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
  tickerSymbol: string;
  tickerName: string;
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
        (label) =>
          line.toUpperCase() === label ||
          line.toUpperCase().startsWith(`${label} `),
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
    providerOptions?: OpenAiReasoningProviderOptions;
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
    ...(params.providerOptions !== undefined
      ? { providerOptions: params.providerOptions }
      : {}),
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
    providerOptions?: OpenAiReasoningProviderOptions;
  },
  deps: { generateObjectForExtraction: GenerateObjectForExtraction } = {
    generateObjectForExtraction: defaultGenerateObjectForExtraction,
  },
): Promise<LlmExtractionCallResult> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const systemContent = String(params.messages[0]?.content ?? "");
  const userContent = String(
    params.messages[params.messages.length - 1]?.content ?? "",
  );
  const shouldBuildMessages =
    (params.exemplars !== undefined && params.exemplars.length > 0) ||
    (params.brainstormText !== undefined &&
      params.brainstormText.trim().length > 0);
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
    ...(params.providerOptions !== undefined
      ? { providerOptions: params.providerOptions }
      : {}),
  });
  return {
    object: normalizeLlmExtractionWire(raw.object),
    usage: raw.usage,
  };
};

const RELATION_CRITIQUE_SYSTEM_PROMPT = [
  "You critique knowledge-graph relation triples extracted from ONE article.",
  "For each candidate triple (fromEntityName, toEntityName, relationTypeId), score:",
  "textualSupport (1–5): does the article text actually assert this relationship?",
  "correctnessOfType (1–5): is relationTypeId the best label from RELATION TYPES?",
  "novelty (1–5): does the triple add information beyond naming the entities?",
  "Set drop=true only when the triple should not be persisted.",
  "Provide evidenceSpan: one sentence quoting or paraphrasing the article (max 280 chars).",
  "Rate ONLY the numbered candidates — do not invent new triples.",
  "RELATION TYPES (uuid — label):\n{{relationTypesBlock}}",
].join("\n\n");

/**
 * Stable key for matching critique ratings to extracted relation rows.
 *
 * @param relation - Candidate or rating row with endpoint names and type id.
 */
export const relationCritiqueRowKey = (relation: {
  fromEntityName: string;
  toEntityName: string;
  relationTypeId: string;
}): string =>
  `${relation.fromEntityName}\0${relation.toEntityName}\0${relation.relationTypeId}`;

/**
 * Serializes relation candidates as a numbered list for the critique user turn.
 *
 * @param candidates - Post-grounding relations for one source.
 */
export const formatRelationCritiqueCandidatesBlock = (
  candidates: readonly RelationCritiqueCandidate[],
): string =>
  candidates
    .map(
      (relation, index) =>
        `${String(index + 1)}. from=${relation.fromEntityName} to=${relation.toEntityName} relationTypeId=${relation.relationTypeId}`,
    )
    .join("\n");

/**
 * Builds the relation-critique system prompt with allowed relation type vocabulary.
 *
 * @param ctx - Analysis GET vocabulary slice.
 */
export const buildRelationCritiqueSystemContent = (
  ctx: Pick<GetAnalysisResponse, "relationTypes">,
): string =>
  substituteLlmPromptTemplate(RELATION_CRITIQUE_SYSTEM_PROMPT, {
    relationTypesBlock: formatArticleAnalysisRelationTypesBlock(ctx),
  });

/**
 * Builds the relation-critique user message with full article text and candidates.
 *
 * @param args - Article title, full body, and candidate triples.
 */
export const buildRelationCritiqueUserContent = (args: {
  articleTitle: string;
  articleBody: string;
  candidates: readonly RelationCritiqueCandidate[];
}): string =>
  [
    `title: ${args.articleTitle}`,
    "article:",
    args.articleBody,
    "Candidate relation triples (rate every row; use exact from/to/relationTypeId strings):",
    formatRelationCritiqueCandidatesBlock(args.candidates),
  ].join("\n\n");

/**
 * Builds chat messages for the relation self-critique pass.
 *
 * @param ctx - Vocabulary from analysis GET.
 * @param args - Article title, full body, and candidate triples.
 */
export const buildRelationCritiqueModelMessages = (
  ctx: Pick<GetAnalysisResponse, "relationTypes">,
  args: {
    articleTitle: string;
    articleBody: string;
    candidates: readonly RelationCritiqueCandidate[];
  },
): ModelMessage[] => [
  { role: "system", content: buildRelationCritiqueSystemContent(ctx) },
  { role: "user", content: buildRelationCritiqueUserContent(args) },
];

/**
 * Applies critique ratings to relations with a hard cap on how many rows may drop.
 *
 * Only ratings with `drop: true` that match a candidate triple are eligible.
 * Among those, the lowest `textualSupport + correctnessOfType + novelty` scores
 * are removed first, up to `floor(candidates.length * dropFraction)`.
 *
 * @param relations - Post-grounding relation candidates for one source.
 * @param ratings - Model critique output (unmatched ratings are ignored).
 * @param dropFraction - Maximum fraction of candidates that may be removed (0–0.5).
 * @returns Filtered relations, drop count, and evidence spans for kept/dropped rows.
 */
export const applyRelationCritiqueDrops = (
  relations: readonly RelationCritiqueCandidate[],
  ratings: readonly LlmRelationCritiqueRating[],
  dropFraction: number,
): {
  relations: RelationCritiqueCandidate[];
  droppedCount: number;
  evidenceByKey: ReadonlyMap<string, string>;
} => {
  const candidateKeys = new Set(
    relations.map((r) => relationCritiqueRowKey(r)),
  );
  const maxDrops = Math.floor(relations.length * dropFraction);
  const evidenceByKey = new Map<string, string>();

  for (const rating of ratings) {
    const key = relationCritiqueRowKey(rating);
    if (candidateKeys.has(key) && rating.evidenceSpan.trim().length > 0) {
      evidenceByKey.set(key, rating.evidenceSpan.trim());
    }
  }

  if (maxDrops <= 0) {
    return { relations: [...relations], droppedCount: 0, evidenceByKey };
  }

  const flagged = ratings
    .filter(
      (rating) =>
        rating.drop && candidateKeys.has(relationCritiqueRowKey(rating)),
    )
    .map((rating) => ({
      key: relationCritiqueRowKey(rating),
      sortScore:
        rating.textualSupport + rating.correctnessOfType + rating.novelty,
    }))
    .sort((left, right) => left.sortScore - right.sortScore);

  const keysToDrop = new Set(flagged.slice(0, maxDrops).map((row) => row.key));

  const kept = relations.filter(
    (relation) => !keysToDrop.has(relationCritiqueRowKey(relation)),
  );

  return {
    relations: kept,
    droppedCount: relations.length - kept.length,
    evidenceByKey,
  };
};

/**
 * Runs the relation self-critique pass for one source via `generateObject`.
 *
 * @param params - API key, model, token limit, and chat messages.
 * @param deps - Injectable `generateObject` wrapper (tests swap mock).
 */
export const critiqueExtractedRelations = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    messages: ModelMessage[];
    providerOptions?: OpenAiReasoningProviderOptions;
  },
  deps: {
    generateObjectForRelationCritique: GenerateObjectForRelationCritique;
  } = {
    generateObjectForRelationCritique: defaultGenerateObjectForRelationCritique,
  },
): Promise<LlmRelationCritiqueCallResult> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const raw = await deps.generateObjectForRelationCritique({
    model: openai(params.model),
    schema: llmRelationCritiqueSchema,
    maxOutputTokens: params.maxOutputTokens,
    messages: params.messages,
    ...(params.providerOptions !== undefined
      ? { providerOptions: params.providerOptions }
      : {}),
  });
  return {
    ratings: raw.object.ratings,
    usage: raw.usage,
  };
};

/**
 * Builds the vocabulary-repair system prompt with allowed type UUID blocks.
 *
 * @param ctx - Vocabulary from analysis GET.
 */
export const buildVocabularyRepairSystemContent = (
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
): string =>
  substituteLlmPromptTemplate(
    ARTICLE_ANALYSIS_REPAIR_SYSTEM_PROMPT_TEMPLATE_DEFAULT,
    {
      entityTypesBlock: formatArticleAnalysisEntityTypesBlock(ctx),
      relationTypesBlock: formatArticleAnalysisRelationTypesBlock(ctx),
    },
  );

/**
 * Serializes rejected entities and relations for the repair user turn.
 *
 * @param badEntities - Rows rejected for unknown `typeId`.
 * @param badRelations - Rows rejected for unknown type or bad endpoints.
 */
export const formatVocabularyRepairRejectedBlock = (
  badEntities: readonly BadEntityRecord[],
  badRelations: readonly BadRelationRecord[],
): string => {
  const entityLines = badEntities.map(
    (row) =>
      `- entity canonicalName=${row.entity.canonicalName} typeId=${row.entity.typeId} reason=${row.reason}`,
  );
  const relationLines = badRelations.map(
    (row) =>
      `- relation from=${row.relation.fromEntityName} to=${row.relation.toEntityName} relationTypeId=${row.relation.relationTypeId} reason=${row.reason}`,
  );
  return [...entityLines, ...relationLines].join("\n");
};

/**
 * Builds the vocabulary-repair user message listing rejected rows.
 *
 * @param badEntities - Rows rejected for unknown `typeId`.
 * @param badRelations - Rows rejected for unknown type or bad endpoints.
 */
export const buildVocabularyRepairUserContent = (
  badEntities: readonly BadEntityRecord[],
  badRelations: readonly BadRelationRecord[],
): string =>
  [
    "Rejected extraction rows:",
    formatVocabularyRepairRejectedBlock(badEntities, badRelations),
  ].join("\n\n");

/**
 * Builds chat messages for the vocabulary-repair pass.
 *
 * @param ctx - Vocabulary from analysis GET.
 * @param badEntities - Rows to re-label.
 * @param badRelations - Rows to re-label.
 */
export const buildVocabularyRepairModelMessages = (
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
  badEntities: readonly BadEntityRecord[],
  badRelations: readonly BadRelationRecord[],
): ModelMessage[] => [
  { role: "system", content: buildVocabularyRepairSystemContent(ctx) },
  {
    role: "user",
    content: buildVocabularyRepairUserContent(badEntities, badRelations),
  },
];

/**
 * Ensures repair output preserves canonical and endpoint name strings from the input.
 *
 * @param badEntities - Original rejected entities sent to repair.
 * @param badRelations - Original rejected relations sent to repair.
 * @param repaired - Parsed repair model output.
 */
export const vocabularyRepairPreservesIdentity = (
  badEntities: readonly BadEntityRecord[],
  badRelations: readonly BadRelationRecord[],
  repaired: {
    entities: readonly { canonicalName: string }[];
    relations: readonly {
      fromEntityName: string;
      toEntityName: string;
    }[];
  },
): boolean => {
  const expectedEntityNames = new Set(
    badEntities.map((row) => row.entity.canonicalName),
  );
  const repairedEntityNames = new Set(
    repaired.entities.map((entity) => entity.canonicalName),
  );
  if (expectedEntityNames.size !== repairedEntityNames.size) {
    return false;
  }
  for (const name of expectedEntityNames) {
    if (!repairedEntityNames.has(name)) {
      return false;
    }
  }

  const relationKey = (relation: {
    fromEntityName: string;
    toEntityName: string;
  }): string => `${relation.fromEntityName}\0${relation.toEntityName}`;

  const expectedRelationKeys = new Set(
    badRelations.map((row) => relationKey(row.relation)),
  );
  const repairedRelationKeys = new Set(
    repaired.relations.map((relation) => relationKey(relation)),
  );
  if (expectedRelationKeys.size !== repairedRelationKeys.size) {
    return false;
  }
  for (const key of expectedRelationKeys) {
    if (!repairedRelationKeys.has(key)) {
      return false;
    }
  }

  return true;
};

/**
 * Runs a one-shot vocabulary repair call for rejected extraction rows.
 *
 * @param params - API key, model, limits, vocabulary context, and rejected rows.
 * @param deps - Injectable `generateObject` wrapper (tests swap mock).
 */
export const repairExtractionVocabulary = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">;
    badEntities: readonly BadEntityRecord[];
    badRelations: readonly BadRelationRecord[];
    providerOptions?: OpenAiReasoningProviderOptions;
  },
  deps: {
    generateObjectForVocabularyRepair: GenerateObjectForVocabularyRepair;
  } = {
    generateObjectForVocabularyRepair: defaultGenerateObjectForVocabularyRepair,
  },
): Promise<LlmVocabularyRepairCallResult> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const raw = await deps.generateObjectForVocabularyRepair({
    model: openai(params.model),
    schema: llmVocabularyRepairWireSchema,
    maxOutputTokens: params.maxOutputTokens,
    messages: buildVocabularyRepairModelMessages(
      params.ctx,
      params.badEntities,
      params.badRelations,
    ),
    ...(params.providerOptions !== undefined
      ? { providerOptions: params.providerOptions }
      : {}),
  });

  if (
    !vocabularyRepairPreservesIdentity(
      params.badEntities,
      params.badRelations,
      raw.object,
    )
  ) {
    return { entities: [], relations: [], usage: raw.usage };
  }

  return {
    entities: raw.object.entities.map((entity) => ({
      canonicalName: entity.canonicalName,
      typeId: entity.typeId,
      aliases: entity.aliases,
    })),
    relations: raw.object.relations,
    usage: raw.usage,
  };
};
