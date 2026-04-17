import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type ModelMessage } from "ai";
import type { GetAnalysisResponse } from "@workspace/agent-data-api-contract";
import { z } from "zod";

const sentimentSchema = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);

const llmExtractionOpenAiWireSchema = z.object({
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

/**
 * System prompt listing allowed entity and relation type UUIDs from analysis GET.
 *
 * @param ctx - Vocabulary from analysis GET.
 * @returns System message string (no article body, no secrets).
 */
export const buildExtractionSystemContent = (
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
): string => {
  const et = ctx.entityTypes.map((e) => `- ${e.id} — ${e.name}`).join("\n");
  const rt = ctx.relationTypes.map((r) => `- ${r.id} — ${r.name}`).join("\n");
  return [
    "You extract knowledge-graph entities and relations from ONE article for equity research tooling.",
    "Use ONLY entity typeId values listed under ENTITY TYPES and ONLY relationTypeId values under RELATION TYPES.",
    "Relation fromEntityName and toEntityName must match canonicalName strings of entities you output (not aliases).",
    "Prefer high-precision entities; omit uncertain extractions.",
    'Every entity must include description as a string; use an empty string "" when there is no short description.',
    "Every entity must include aliases as an array (use [] when there are no aliases beyond canonicalName).",
    "Also populate articleMentions: for entities in your entities array that appear in the article text, estimate mentionCount (positive integer), confidence (0–1), and sentiment POSITIVE | NEGATIVE | NEUTRAL, or NONE when not applicable.",
    "Each articleMentions.entityName must exactly match the canonicalName of one row in your entities array (same spelling as canonicalName).",
    "Return JSON object with keys entities, relations, and articleMentions (arrays; articleMentions may be empty).",
    "ENTITY TYPES (uuid — label):\n" + et,
    "RELATION TYPES (uuid — label):\n" + rt,
  ].join("\n\n");
};

/**
 * User message with ticker metadata and truncated article text.
 *
 * @param args - Ticker, title, truncated body (already capped for token budget).
 * @returns User message string.
 */
export const buildExtractionUserContent = (args: {
  tickerId: string;
  title: string;
  contentTruncated: string;
}): string =>
  [
    `tickerId: ${args.tickerId}`,
    `title: ${args.title}`,
    "article:",
    args.contentTruncated,
  ].join("\n\n");

/**
 * Runs structured extraction for one data source via `generateObject`.
 *
 * @param params - API key, model, token limit, chat messages.
 * @param deps - Injectable `generateObject` wrapper (tests swap mock).
 * @returns Parsed entities and relations plus optional tokenizer usage.
 */
export const extractEntitiesAndRelationsForSource = async (
  params: {
    apiKey: string;
    model: string;
    maxOutputTokens: number;
    messages: ModelMessage[];
  },
  deps: { generateObjectForExtraction: GenerateObjectForExtraction } = {
    generateObjectForExtraction: defaultGenerateObjectForExtraction,
  },
): Promise<LlmExtractionCallResult> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const raw = await deps.generateObjectForExtraction({
    model: openai(params.model),
    schema: llmExtractionOpenAiWireSchema,
    maxOutputTokens: params.maxOutputTokens,
    messages: params.messages,
  });
  return {
    object: normalizeLlmExtractionWire(raw.object),
    usage: raw.usage,
  };
};
