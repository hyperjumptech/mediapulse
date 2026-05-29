import {
  postAnalysisBodySchema,
  type PostAnalysisBody,
} from "@workspace/agent-data-api-contract";

import { normalizeEntityName } from "./normalize-entity-name.js";

/**
 * Indexes entities by normalized canonical name and alias strings for relation endpoint closure.
 *
 * @param entities - Full deduped entity list for the run.
 * @returns Map from normalized name to entity row (first registration wins).
 */
export const buildEntityNameLookup = (
  entities: ReadonlyArray<PostAnalysisBody["entities"][number]>,
): Map<string, PostAnalysisBody["entities"][number]> => {
  const map = new Map<string, PostAnalysisBody["entities"][number]>();
  const register = (raw: string, row: PostAnalysisBody["entities"][number]) => {
    const k = normalizeEntityName(raw);
    if (!map.has(k)) {
      map.set(k, row);
    }
  };
  for (const e of entities) {
    register(e.canonicalName, e);
    for (const a of e.aliases) {
      register(a, e);
    }
  }
  return map;
};

export type BuildAnalysisPostChunksResult = {
  chunks: PostAnalysisBody[];
  droppedRelations: number;
  parseErrors: string[];
};

/**
 * Splits relations into sequential POST bodies; each chunk includes entity closure required
 * by `applyAnalysisPost` (endpoints must appear in the same body's `entities` array).
 *
 * @param tickerId - Ticker for POST body.
 * @param entities - Deduped entities for the run (global catalog).
 * @param relations - Deduped relations for the run.
 * @param postChunkRelationBatchSize - Max relations per chunk (FR9).
 * @returns Validated chunks and any validation messages (no secrets / content).
 */
export const buildAnalysisPostChunks = (
  tickerId: string,
  entities: PostAnalysisBody["entities"],
  relations: PostAnalysisBody["relations"],
  postChunkRelationBatchSize: number,
  entityEvidence: PostAnalysisBody["entityEvidence"] = [],
  relationEvidence: PostAnalysisBody["relationEvidence"] = [],
): BuildAnalysisPostChunksResult => {
  const chunks: PostAnalysisBody[] = [];
  const parseErrors: string[] = [];
  let droppedRelations = 0;
  const nameLookup = buildEntityNameLookup(entities);

  const relationEvidenceKey = (
    row: PostAnalysisBody["relationEvidence"][number],
  ): string =>
    `${normalizeEntityName(row.fromEntityName)}\0${normalizeEntityName(row.toEntityName)}\0${row.relationTypeId}`;

  const entityEvidenceForChunk = (
    chunkEntities: PostAnalysisBody["entities"],
  ): PostAnalysisBody["entityEvidence"] => {
    const allowedNames = new Set<string>();
    for (const entity of chunkEntities) {
      allowedNames.add(normalizeEntityName(entity.canonicalName));
      for (const alias of entity.aliases) {
        allowedNames.add(normalizeEntityName(alias));
      }
    }
    return entityEvidence.filter((row) =>
      allowedNames.has(normalizeEntityName(row.entityName)),
    );
  };

  const relationEvidenceForChunk = (
    chunkRelations: PostAnalysisBody["relations"],
  ): PostAnalysisBody["relationEvidence"] => {
    const allowedKeys = new Set(
      chunkRelations.map(
        (relation) =>
          `${normalizeEntityName(relation.fromEntityName)}\0${normalizeEntityName(relation.toEntityName)}\0${relation.relationTypeId}`,
      ),
    );
    return relationEvidence.filter((row) =>
      allowedKeys.has(relationEvidenceKey(row)),
    );
  };

  if (relations.length === 0) {
    if (entities.length > 0) {
      const body: PostAnalysisBody = {
        tickerId,
        entities: [...entities],
        relations: [],
        articleEntities: [],
        articleRelevances: [],
        entityEvidence: entityEvidenceForChunk(entities),
        relationEvidence: [],
      };
      const parsed = postAnalysisBodySchema.safeParse(body);
      if (!parsed.success) {
        parseErrors.push(parsed.error.flatten().formErrors.join("; "));
      } else {
        chunks.push(parsed.data);
      }
    }
    return { chunks, droppedRelations, parseErrors };
  }

  for (let i = 0; i < relations.length; i += postChunkRelationBatchSize) {
    const relWindow = relations.slice(i, i + postChunkRelationBatchSize);
    const filtered = relWindow.filter((r) => {
      const hasFrom = nameLookup.has(normalizeEntityName(r.fromEntityName));
      const hasTo = nameLookup.has(normalizeEntityName(r.toEntityName));
      if (!hasFrom || !hasTo) {
        droppedRelations += 1;
        parseErrors.push(
          `Dropped relation (missing entity endpoint in catalog): ${r.fromEntityName} -> ${r.toEntityName}`,
        );
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      continue;
    }

    const neededNorm = new Set<string>();
    for (const r of filtered) {
      neededNorm.add(normalizeEntityName(r.fromEntityName));
      neededNorm.add(normalizeEntityName(r.toEntityName));
    }

    const chunkEntities: PostAnalysisBody["entities"] = [];
    const seenEntityKey = new Set<string>();
    for (const nk of neededNorm) {
      const ent = nameLookup.get(nk);
      if (!ent) {
        continue;
      }
      const ek = `${normalizeEntityName(ent.canonicalName)}\0${ent.typeId}`;
      if (!seenEntityKey.has(ek)) {
        seenEntityKey.add(ek);
        chunkEntities.push(ent);
      }
    }

    const body: PostAnalysisBody = {
      tickerId,
      entities: chunkEntities,
      relations: filtered,
      articleEntities: [],
      articleRelevances: [],
      entityEvidence: entityEvidenceForChunk(chunkEntities),
      relationEvidence: relationEvidenceForChunk(filtered),
    };

    const parsed = postAnalysisBodySchema.safeParse(body);
    if (!parsed.success) {
      parseErrors.push(parsed.error.flatten().formErrors.join("; "));
      continue;
    }
    chunks.push(parsed.data);
  }

  return { chunks, droppedRelations, parseErrors };
};
