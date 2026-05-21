import type { GetAnalysisResponse } from "@workspace/agent-data-api-contract";

import type {
  ExtractionExemplar,
  ExtractionExemplarArchetype,
  ExtractionExemplarExpectedOutput,
  ResolvedExemplar,
} from "./default-extraction-exemplars.js";

const ENTITY_TYPE_SENTINEL = /^\{\{ENTITY_TYPE:([^}]+)\}\}$/;
const RELATION_TYPE_SENTINEL = /^\{\{RELATION_TYPE:([^}]+)\}\}$/;

type AnalysisVocabularyContext = Pick<
  GetAnalysisResponse,
  "entityTypes" | "relationTypes"
>;

/**
 * Finds an entity type UUID by label (case-insensitive).
 *
 * @param ctx - Analysis GET vocabulary.
 * @param label - Entity type name from a sentinel placeholder.
 */
const resolveEntityTypeId = (
  ctx: AnalysisVocabularyContext,
  label: string,
): string | null => {
  const normalized = label.trim().toLowerCase();
  const match = ctx.entityTypes.find(
    (entityType) => entityType.name.toLowerCase() === normalized,
  );
  return match?.id ?? null;
};

/**
 * Finds a relation type UUID by label (case-insensitive).
 *
 * @param ctx - Analysis GET vocabulary.
 * @param label - Relation type name from a sentinel placeholder.
 */
const resolveRelationTypeId = (
  ctx: AnalysisVocabularyContext,
  label: string,
): string | null => {
  const normalized = label.trim().toLowerCase();
  const match = ctx.relationTypes.find(
    (relationType) => relationType.name.toLowerCase() === normalized,
  );
  return match?.id ?? null;
};

/**
 * Resolves one sentinel UUID field against analysis GET vocabulary.
 *
 * @param value - Raw field value that may contain a sentinel placeholder.
 * @param ctx - Analysis GET vocabulary.
 */
const resolveSentinelUuid = (
  value: string,
  ctx: AnalysisVocabularyContext,
): string | null => {
  const entityMatch = value.match(ENTITY_TYPE_SENTINEL);
  if (entityMatch?.[1]) {
    return resolveEntityTypeId(ctx, entityMatch[1]);
  }

  const relationMatch = value.match(RELATION_TYPE_SENTINEL);
  if (relationMatch?.[1]) {
    return resolveRelationTypeId(ctx, relationMatch[1]);
  }

  return value;
};

/**
 * Materializes sentinel placeholders in one exemplar output; returns null when any UUID is missing.
 *
 * @param expectedOutput - Unresolved exemplar output with sentinel placeholders.
 * @param ctx - Analysis GET vocabulary.
 */
const resolveExpectedOutput = (
  expectedOutput: ExtractionExemplarExpectedOutput,
  ctx: AnalysisVocabularyContext,
): ResolvedExemplar["expectedOutput"] | null => {
  const entities: ResolvedExemplar["expectedOutput"]["entities"] = [];

  for (const entity of expectedOutput.entities) {
    const typeId = resolveSentinelUuid(entity.typeId, ctx);
    if (typeId === null) {
      return null;
    }
    entities.push({
      canonicalName: entity.canonicalName,
      typeId,
      description: entity.description,
      aliases: entity.aliases,
    });
  }

  const relations: ResolvedExemplar["expectedOutput"]["relations"] = [];

  for (const relation of expectedOutput.relations) {
    const relationTypeId = resolveSentinelUuid(relation.relationTypeId, ctx);
    if (relationTypeId === null) {
      return null;
    }
    relations.push({
      fromEntityName: relation.fromEntityName,
      toEntityName: relation.toEntityName,
      relationTypeId,
    });
  }

  return {
    entities,
    relations,
    articleMentions: expectedOutput.articleMentions.map((mention) => ({
      ...mention,
    })),
  };
};

/**
 * Resolves one exemplar against ticker vocabulary, skipping it when sentinels cannot be mapped.
 *
 * @param exemplar - Static exemplar definition.
 * @param ctx - Analysis GET vocabulary.
 */
export const resolveExemplarForContext = (
  exemplar: ExtractionExemplar,
  ctx: AnalysisVocabularyContext,
): ResolvedExemplar | null => {
  const expectedOutput = resolveExpectedOutput(exemplar.expectedOutput, ctx);
  if (expectedOutput === null) {
    return null;
  }

  return {
    archetype: exemplar.archetype,
    articleSnippet: exemplar.articleSnippet,
    expectedOutput,
  };
};

/**
 * Selects and resolves up to `count` exemplars for the current ticker vocabulary.
 *
 * @param exemplars - Static exemplar library.
 * @param ctx - Analysis GET vocabulary.
 * @param count - Maximum exemplars to inject (0 disables few-shot).
 * @param allowedArchetypes - Optional archetype filter from Hermes config.
 */
export const resolveExemplarsForContext = (
  exemplars: readonly ExtractionExemplar[],
  ctx: AnalysisVocabularyContext,
  count: number,
  allowedArchetypes?: readonly ExtractionExemplarArchetype[],
): ResolvedExemplar[] => {
  if (count <= 0) {
    return [];
  }

  const allowed =
    allowedArchetypes === undefined
      ? null
      : new Set<ExtractionExemplarArchetype>(allowedArchetypes);

  const candidates = exemplars.filter((exemplar) =>
    allowed === null ? true : allowed.has(exemplar.archetype),
  );

  const resolved: ResolvedExemplar[] = [];

  for (const exemplar of candidates) {
    if (resolved.length >= count) {
      break;
    }

    const materialized = resolveExemplarForContext(exemplar, ctx);
    if (materialized !== null) {
      resolved.push(materialized);
    }
  }

  return resolved;
};
