import type {
  GetAnalysisResponse,
  PostAnalysisBody,
} from "@workspace/agent-data-api-contract";

export type EntityProposal = PostAnalysisBody["entities"][number];
export type RelationProposal = PostAnalysisBody["relations"][number];

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
