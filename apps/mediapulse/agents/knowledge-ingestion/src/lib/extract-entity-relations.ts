import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type ModelMessage } from "ai";
import type { ZodType } from "zod";
import { normalizeEntityName, textNamesEntity } from "@workspace/utils";

import { DISCARDED_ENTITY_KINDS } from "./knowledge-kinds.js";

import {
  buildExtractionMessages,
  extractionArticleText,
  type BuildExtractionMessagesInput,
  type ExtractionArticle,
  type ExtractionIssuer,
  type CandidateParty,
} from "./build-extraction-messages.js";
import {
  entityExtractionSchema,
  MAX_EVIDENCE_SPAN_CHARS,
  type EntityExtraction,
  type ExtractedEntity,
  type ExtractedRelation,
} from "./entity-extraction-schema.js";

export type ExtractionLlmParams = {
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
};

/** Why a candidate entity or relation was thrown away. */
export type ExtractionRejection = {
  reason:
    | "span-not-in-text"
    | "name-not-in-text"
    | "endpoint-unknown"
    | "self-relation"
    | "person";
  detail: string;
};

export type ExtractionOutcome = {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  rejections: ExtractionRejection[];
  /** False when the article named nothing worth a model call and none was made. */
  modelCalled: boolean;
  usage?: { inputTokens: number; outputTokens: number };
};

export type ExtractEntityRelationsInput = {
  article: ExtractionArticle;
  issuer: ExtractionIssuer;
  candidates: readonly CandidateParty[];
  relationKindLabels: readonly string[];
  llm: ExtractionLlmParams;
  /** Injected for tests; defaults to the AI SDK's `generateObject`. */
  generateObjectFn?: typeof generateObject;
  buildMessagesFn?: (input: BuildExtractionMessagesInput) => ModelMessage[];
  schema?: ZodType<EntityExtraction>;
};

/** Collapses whitespace so a span that differs only in line breaks still matches. */
const flatten = (value: string): string =>
  value.replace(/\s+/gu, " ").trim().toLowerCase();

/**
 * Whether a span appears in the article as written.
 *
 * - Important: this is the guard that keeps extraction honest. A model that summarises a sentence
 *   instead of copying it is inventing evidence, and nothing it reported alongside can be trusted.
 *
 * @param articleText - The article as the prompt showed it.
 * @param span - The span the model returned.
 */
export const spanIsInText = (articleText: string, span: string): boolean => {
  const needle = flatten(span);

  return needle.length > 0 && flatten(articleText).includes(needle);
};

/**
 * Whether the article names a party under the spelling the model reported.
 *
 * @param articleText - The article as the prompt showed it.
 * @param entity - The reported entity.
 */
export const entityIsNamedInText = (
  articleText: string,
  entity: ExtractedEntity,
): boolean =>
  textNamesEntity(articleText, entity.surfaceForm) ||
  textNamesEntity(articleText, entity.name);

const MIN_NAME_CHARS = 2;

export const clipSpan = (
  span: string,
  anchors: readonly string[],
  maxChars: number = MAX_EVIDENCE_SPAN_CHARS,
): string => {
  const trimmed = span.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  const lowered = trimmed.toLowerCase();
  const hits = anchors
    .map((anchor) => anchor.trim())
    .filter((anchor) => anchor.length > 0)
    .map((anchor) => {
      const start = lowered.indexOf(anchor.toLowerCase());

      return { start, end: start + anchor.length };
    })
    .filter((hit) => hit.start !== -1);
  if (hits.length === 0) {
    return trimmed.slice(0, maxChars).trim();
  }

  const firstStart = Math.min(...hits.map((hit) => hit.start));
  const lastEnd = Math.max(...hits.map((hit) => hit.end));
  if (lastEnd - firstStart > maxChars) {
    return trimmed.slice(firstStart, firstStart + maxChars).trim();
  }

  const padding = Math.floor((maxChars - (lastEnd - firstStart)) / 2);
  const paddedStart = Math.max(0, firstStart - padding);
  const windowEnd = Math.min(trimmed.length, paddedStart + maxChars);
  const windowStart = Math.max(0, windowEnd - maxChars);

  return trimmed.slice(windowStart, windowEnd).trim();
};

const withNamesFilled = (entity: ExtractedEntity): ExtractedEntity => {
  const name =
    entity.name.trim().length < MIN_NAME_CHARS
      ? entity.surfaceForm
      : entity.name;
  const surfaceForm =
    entity.surfaceForm.trim().length < MIN_NAME_CHARS
      ? name
      : entity.surfaceForm;

  return { ...entity, name, surfaceForm };
};

const isIssuerName = (name: string, issuer: ExtractionIssuer): boolean => {
  const normalized = normalizeEntityName(name);
  if (normalized.length === 0) {
    return false;
  }

  return [issuer.name, issuer.symbol, ...issuer.aliases].some(
    (known) => normalizeEntityName(known) === normalized,
  );
};

/**
 * Applies every guard to one model response.
 *
 * @param extraction - What the model returned.
 * @param articleText - The article as the prompt showed it.
 * @param issuer - The issuer being read for.
 * @returns What survived, and why the rest did not.
 */
export const applyExtractionGuards = (
  extraction: EntityExtraction,
  articleText: string,
  issuer: ExtractionIssuer,
): Omit<ExtractionOutcome, "modelCalled"> => {
  const rejections: ExtractionRejection[] = [];
  const entities: ExtractedEntity[] = [];

  const discarded = new Set<string>(DISCARDED_ENTITY_KINDS);

  for (const reported of extraction.entities) {
    const entity = withNamesFilled(reported);
    if (isIssuerName(entity.name, issuer)) {
      continue;
    }
    if (discarded.has(entity.kind)) {
      rejections.push({ reason: "person", detail: entity.name });

      continue;
    }
    if (!spanIsInText(articleText, entity.evidenceSpan)) {
      rejections.push({ reason: "span-not-in-text", detail: entity.name });

      continue;
    }
    if (!entityIsNamedInText(articleText, entity)) {
      rejections.push({ reason: "name-not-in-text", detail: entity.name });

      continue;
    }
    const evidenceSpan = clipSpan(entity.evidenceSpan, [
      entity.surfaceForm,
      entity.name,
    ]);
    entities.push({ ...entity, evidenceSpan });
  }

  const known = new Map<string, string>();
  known.set(normalizeEntityName(issuer.name), issuer.name);
  for (const alias of [issuer.symbol, ...issuer.aliases]) {
    known.set(normalizeEntityName(alias), issuer.name);
  }
  for (const entity of entities) {
    known.set(normalizeEntityName(entity.name), entity.name);
    known.set(normalizeEntityName(entity.surfaceForm), entity.name);
  }

  const relations: ExtractedRelation[] = [];
  for (const relation of extraction.relations) {
    if (!spanIsInText(articleText, relation.evidenceSpan)) {
      rejections.push({
        reason: "span-not-in-text",
        detail: `${relation.subject} ${relation.kind} ${relation.object}`,
      });

      continue;
    }
    const subject = known.get(normalizeEntityName(relation.subject));
    const object = known.get(normalizeEntityName(relation.object));
    if (subject === undefined || object === undefined) {
      rejections.push({
        reason: "endpoint-unknown",
        detail: `${relation.subject} ${relation.kind} ${relation.object}`,
      });

      continue;
    }
    if (subject === object) {
      rejections.push({ reason: "self-relation", detail: subject });

      continue;
    }
    const evidenceSpan = clipSpan(relation.evidenceSpan, [
      relation.subject,
      relation.object,
    ]);
    relations.push({ ...relation, subject, object, evidenceSpan });
  }

  return { entities, relations, rejections };
};

/**
 * Reads one article for the entities it names and the relations it states.
 *
 * - Important: nothing the model returns is trusted. Every entity must be named in the article and
 *   every claim must carry a span copied from it, or it is counted as a rejection and dropped.
 *
 * @param input - The article, the issuer, the parties on file, and the model to call.
 * @returns What survived the guards, plus whether the model was called at all.
 * @throws Whatever the model call throws, so one unusable article is the caller's to record.
 */
export const extractEntityRelations = async (
  input: ExtractEntityRelationsInput,
): Promise<ExtractionOutcome> => {
  const articleText = extractionArticleText(input.article);
  if (articleText.trim().length === 0) {
    return { entities: [], relations: [], rejections: [], modelCalled: false };
  }

  const buildMessages = input.buildMessagesFn ?? buildExtractionMessages;
  const messages = buildMessages({
    article: input.article,
    issuer: input.issuer,
    candidates: input.candidates,
    relationKindLabels: input.relationKindLabels,
  } satisfies BuildExtractionMessagesInput);

  const openai = createOpenAI({
    apiKey: input.llm.apiKey,
    baseURL: input.llm.baseUrl,
  });
  const generate = input.generateObjectFn ?? generateObject;
  const attempt = () =>
    generate({
      model: openai(input.llm.model),
      schema: input.schema ?? entityExtractionSchema,
      temperature: input.llm.temperature ?? 0,
      messages,
    });
  const result = await attempt().catch(() => attempt());

  const guarded = applyExtractionGuards(
    result.object as EntityExtraction,
    articleText,
    input.issuer,
  );

  return {
    ...guarded,
    modelCalled: true,
    usage: {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    },
  };
};
