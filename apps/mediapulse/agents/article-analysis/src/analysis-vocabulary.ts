import type {
  GetAnalysisResponse,
  PostAnalysisBody,
} from "@workspace/agent-data-api-contract";

export type EntityProposal = PostAnalysisBody["entities"][number];
export type RelationProposal = PostAnalysisBody["relations"][number];

export type BadEntityRecord = {
  entity: EntityProposal;
  reason: "unknown_typeId";
};

export type BadRelationRecord = {
  relation: RelationProposal;
  reason: "unknown_relationTypeId" | "endpoint_in_bad_entities";
};

export type VocabularyPartitionResult = {
  okEntities: EntityProposal[];
  okRelations: RelationProposal[];
  badEntities: BadEntityRecord[];
  badRelations: BadRelationRecord[];
};

/**
 * Ensures every extracted `typeId` and `relationTypeId` appears on the analysis GET vocabulary (FR3).
 *
 * @param entities - Proposed entities from the LLM.
 * @param relations - Proposed relations from the LLM.
 * @param ctx - GET response subsets `entityTypes` and `relationTypes`.
 * @returns Success or failure with a human-readable message (no POST).
 */
export const validateExtractionVocabulary = (
  entities: readonly EntityProposal[],
  relations: readonly RelationProposal[],
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
):
  | { ok: true }
  | {
      ok: false;
      message: string;
    } => {
  const typeIds = new Set(ctx.entityTypes.map((e) => e.id));
  const relIds = new Set(ctx.relationTypes.map((r) => r.id));

  for (const e of entities) {
    if (!typeIds.has(e.typeId)) {
      return {
        ok: false,
        message: `Invalid entity typeId ${e.typeId} (not in GET vocabulary for this ticker run)`,
      };
    }
  }
  for (const r of relations) {
    if (!relIds.has(r.relationTypeId)) {
      return {
        ok: false,
        message: `Invalid relationTypeId ${r.relationTypeId} (not in GET vocabulary for this ticker run)`,
      };
    }
  }
  return { ok: true };
};

/**
 * Splits extraction rows into vocabulary-valid and rejected lists (row-level, not all-or-nothing).
 *
 * Relations whose endpoints reference a rejected entity are moved to `badRelations` with
 * `endpoint_in_bad_entities`. Relations with unknown `relationTypeId` are rejected directly.
 *
 * @param entities - Proposed entities from the LLM.
 * @param relations - Proposed relations from the LLM.
 * @param ctx - GET response subsets `entityTypes` and `relationTypes`.
 */
export const partitionExtractionByVocabulary = (
  entities: readonly EntityProposal[],
  relations: readonly RelationProposal[],
  ctx: Pick<GetAnalysisResponse, "entityTypes" | "relationTypes">,
): VocabularyPartitionResult => {
  const typeIds = new Set(ctx.entityTypes.map((e) => e.id));
  const relIds = new Set(ctx.relationTypes.map((r) => r.id));

  const okEntities: EntityProposal[] = [];
  const badEntities: BadEntityRecord[] = [];

  for (const entity of entities) {
    if (!typeIds.has(entity.typeId)) {
      badEntities.push({ entity, reason: "unknown_typeId" });
    } else {
      okEntities.push(entity);
    }
  }

  const badEntityNames = new Set(
    badEntities.map((row) => row.entity.canonicalName),
  );

  const okRelations: RelationProposal[] = [];
  const badRelations: BadRelationRecord[] = [];

  for (const relation of relations) {
    if (!relIds.has(relation.relationTypeId)) {
      badRelations.push({ relation, reason: "unknown_relationTypeId" });
      continue;
    }
    if (
      badEntityNames.has(relation.fromEntityName) ||
      badEntityNames.has(relation.toEntityName)
    ) {
      badRelations.push({ relation, reason: "endpoint_in_bad_entities" });
      continue;
    }
    okRelations.push(relation);
  }

  return { okEntities, okRelations, badEntities, badRelations };
};
