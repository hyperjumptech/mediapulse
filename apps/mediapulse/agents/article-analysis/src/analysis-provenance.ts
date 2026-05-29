import type { PostAnalysisBody } from "@workspace/agent-data-api-contract";

import type { ArticleMentionProposal } from "./analysis-article-mentions.js";
import type {
  EntityProposal,
  RelationProposal,
} from "./analysis-vocabulary.js";
import { relationCritiqueRowKey } from "./llm-extract-entities.js";
import { normalizeEntityName } from "./normalize-entity-name.js";

/** One row for `postAnalysisBodySchema.entityEvidence`. */
export type EntityEvidenceRow = PostAnalysisBody["entityEvidence"][number];

/** One row for `postAnalysisBodySchema.relationEvidence`. */
export type RelationEvidenceRow = PostAnalysisBody["relationEvidence"][number];

/**
 * Maps capped entities for one source to entity provenance rows.
 *
 * @param dataSourceId - UUID of the `DataSource` row (never from the LLM).
 * @param entities - Capped entity proposals for the source.
 * @param mentions - Capped mention proposals used to infer confidence when present.
 * @returns `entityEvidence` payload rows.
 */
export const toEntityEvidenceRowsForSource = (
  dataSourceId: string,
  entities: readonly EntityProposal[],
  mentions: readonly ArticleMentionProposal[],
): EntityEvidenceRow[] => {
  const mentionConfidenceByName = new Map<string, number>();
  for (const mention of mentions) {
    const key = normalizeEntityName(mention.entityName);
    const prev = mentionConfidenceByName.get(key);
    mentionConfidenceByName.set(
      key,
      prev === undefined
        ? mention.confidence
        : Math.max(prev, mention.confidence),
    );
  }

  return entities.map((entity) => {
    const aliasConfidence = entity.aliases
      .map((alias) => mentionConfidenceByName.get(normalizeEntityName(alias)))
      .find((value) => value !== undefined);
    const confidence =
      mentionConfidenceByName.get(normalizeEntityName(entity.canonicalName)) ??
      aliasConfidence;
    return {
      dataSourceId,
      entityName: entity.canonicalName.trim(),
      ...(confidence !== undefined ? { confidence } : {}),
    };
  });
};

/**
 * Maps capped relations for one source to relation provenance rows.
 *
 * @param dataSourceId - UUID of the `DataSource` row (never from the LLM).
 * @param relations - Capped relation proposals for the source.
 * @param evidenceByKey - Optional critique evidence spans keyed by relation triple.
 * @returns `relationEvidence` payload rows.
 */
export const toRelationEvidenceRowsForSource = (
  dataSourceId: string,
  relations: readonly RelationProposal[],
  evidenceByKey?: ReadonlyMap<string, string>,
): RelationEvidenceRow[] =>
  relations.map((relation) => {
    const evidenceSpan = evidenceByKey?.get(relationCritiqueRowKey(relation));
    return {
      dataSourceId,
      fromEntityName: relation.fromEntityName.trim(),
      toEntityName: relation.toEntityName.trim(),
      relationTypeId: relation.relationTypeId,
      ...(evidenceSpan !== undefined && evidenceSpan.length > 0
        ? { evidenceSpan }
        : {}),
    };
  });

/**
 * Dedupes by (`dataSourceId`, normalized `entityName`). Keeps max confidence when duplicated.
 *
 * @param rows - Rows possibly containing duplicates for the same source and entity.
 * @returns Deduplicated rows (Map iteration order).
 */
export const dedupeEntityEvidence = (
  rows: readonly EntityEvidenceRow[],
): EntityEvidenceRow[] => {
  const map = new Map<string, EntityEvidenceRow>();
  for (const row of rows) {
    const key = `${row.dataSourceId}\0${normalizeEntityName(row.entityName)}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
      continue;
    }
    map.set(key, {
      ...existing,
      ...(row.confidence !== undefined && row.confidence !== null
        ? {
            confidence: Math.max(existing.confidence ?? 0, row.confidence),
          }
        : {}),
    });
  }
  return [...map.values()];
};

/**
 * Dedupes by source, endpoints, and relation type id.
 *
 * @param rows - Rows possibly containing duplicates for the same source and relation triple.
 * @returns Deduplicated rows (Map iteration order).
 */
export const dedupeRelationEvidence = (
  rows: readonly RelationEvidenceRow[],
): RelationEvidenceRow[] => {
  const map = new Map<string, RelationEvidenceRow>();
  for (const row of rows) {
    const key = `${row.dataSourceId}\0${normalizeEntityName(row.fromEntityName)}\0${normalizeEntityName(row.toEntityName)}\0${row.relationTypeId}`;
    if (!map.has(key)) {
      map.set(key, { ...row });
    }
  }
  return [...map.values()];
};

/**
 * Canonicalizes entity evidence names using run-level entity proposals.
 *
 * @param rows - Evidence rows after run-level filtering.
 * @param entities - Final run-level entity proposals.
 * @returns Canonicalized rows and drop count for unmapped names.
 */
export const canonicalizeEntityEvidenceRowsToRunEntities = (
  rows: readonly EntityEvidenceRow[],
  entities: readonly EntityProposal[],
): { rows: EntityEvidenceRow[]; droppedCount: number } => {
  const aliasToCanonical = new Map<string, string>();
  for (const entity of entities) {
    aliasToCanonical.set(
      normalizeEntityName(entity.canonicalName),
      entity.canonicalName.trim(),
    );
    for (const alias of entity.aliases) {
      aliasToCanonical.set(
        normalizeEntityName(alias),
        entity.canonicalName.trim(),
      );
    }
  }

  const out: EntityEvidenceRow[] = [];
  let droppedCount = 0;
  for (const row of rows) {
    const canonicalName = aliasToCanonical.get(
      normalizeEntityName(row.entityName),
    );
    if (!canonicalName) {
      droppedCount += 1;
      continue;
    }
    out.push({
      ...row,
      entityName: canonicalName,
    });
  }
  return { rows: out, droppedCount };
};

/**
 * Canonicalizes relation evidence endpoint names using run-level entity proposals.
 *
 * @param rows - Evidence rows after run-level filtering.
 * @param entities - Final run-level entity proposals.
 * @returns Canonicalized rows and drop count for unmapped endpoint names.
 */
export const canonicalizeRelationEvidenceRowsToRunEntities = (
  rows: readonly RelationEvidenceRow[],
  entities: readonly EntityProposal[],
): { rows: RelationEvidenceRow[]; droppedCount: number } => {
  const aliasToCanonical = new Map<string, string>();
  for (const entity of entities) {
    aliasToCanonical.set(
      normalizeEntityName(entity.canonicalName),
      entity.canonicalName.trim(),
    );
    for (const alias of entity.aliases) {
      aliasToCanonical.set(
        normalizeEntityName(alias),
        entity.canonicalName.trim(),
      );
    }
  }

  const resolveName = (name: string): string | undefined =>
    aliasToCanonical.get(normalizeEntityName(name));

  const out: RelationEvidenceRow[] = [];
  let droppedCount = 0;
  for (const row of rows) {
    const fromEntityName = resolveName(row.fromEntityName);
    const toEntityName = resolveName(row.toEntityName);
    if (!fromEntityName || !toEntityName) {
      droppedCount += 1;
      continue;
    }
    out.push({
      ...row,
      fromEntityName,
      toEntityName,
    });
  }
  return { rows: out, droppedCount };
};

/**
 * Drops entity evidence rows whose names are not in the run-level entity catalog.
 *
 * @param rows - Merged evidence rows for the run.
 * @param catalog - Normalized keys from run-level entities.
 * @returns Kept rows and drop count.
 */
export const filterEntityEvidenceRowsToRunCatalog = (
  rows: readonly EntityEvidenceRow[],
  catalog: ReadonlySet<string>,
): { rows: EntityEvidenceRow[]; droppedCount: number } => {
  const out: EntityEvidenceRow[] = [];
  let droppedCount = 0;
  for (const row of rows) {
    if (catalog.has(normalizeEntityName(row.entityName))) {
      out.push(row);
    } else {
      droppedCount += 1;
    }
  }
  return { rows: out, droppedCount };
};

/**
 * Drops relation evidence rows when either endpoint is not in the run-level entity catalog.
 *
 * @param rows - Merged evidence rows for the run.
 * @param catalog - Normalized keys from run-level entities.
 * @returns Kept rows and drop count.
 */
export const filterRelationEvidenceRowsToRunCatalog = (
  rows: readonly RelationEvidenceRow[],
  catalog: ReadonlySet<string>,
): { rows: RelationEvidenceRow[]; droppedCount: number } => {
  const out: RelationEvidenceRow[] = [];
  let droppedCount = 0;
  for (const row of rows) {
    const fromOk = catalog.has(normalizeEntityName(row.fromEntityName));
    const toOk = catalog.has(normalizeEntityName(row.toEntityName));
    if (fromOk && toOk) {
      out.push(row);
    } else {
      droppedCount += 1;
    }
  }
  return { rows: out, droppedCount };
};
