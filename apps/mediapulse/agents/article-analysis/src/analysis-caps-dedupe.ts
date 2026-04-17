import type {
  EntityProposal,
  RelationProposal,
} from "./analysis-vocabulary.js";
import { normalizeEntityName } from "./normalize-entity-name.js";

/**
 * Truncates per-article extraction to configured maxima (deterministic: array prefix order).
 *
 * @param entities - Proposed entities for one article.
 * @param relations - Proposed relations for one article.
 * @param maxEntitiesPerArticle - Cap on entities.
 * @param maxRelationsPerArticle - Cap on relations.
 * @returns Truncated copies.
 */
export const applyPerArticleExtractionCaps = (
  entities: readonly EntityProposal[],
  relations: readonly RelationProposal[],
  maxEntitiesPerArticle: number,
  maxRelationsPerArticle: number,
): { entities: EntityProposal[]; relations: RelationProposal[] } => ({
  entities: entities.slice(0, maxEntitiesPerArticle),
  relations: relations.slice(0, maxRelationsPerArticle),
});

/**
 * Deduplicates entities by normalized canonical name plus `typeId`.
 *
 * @param entities - Merged proposals across articles.
 * @returns First-seen entity per key.
 */
export const dedupeEntities = (
  entities: readonly EntityProposal[],
): EntityProposal[] => {
  const seen = new Set<string>();
  const out: EntityProposal[] = [];
  for (const e of entities) {
    const key = `${normalizeEntityName(e.canonicalName)}\0${e.typeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(e);
    }
  }
  return out;
};

/**
 * Deduplicates relations by normalized endpoint pair and relation type id.
 *
 * @param relations - Merged relations.
 * @returns First-seen relation per key.
 */
export const dedupeRelations = (
  relations: readonly RelationProposal[],
): RelationProposal[] => {
  const seen = new Set<string>();
  const out: RelationProposal[] = [];
  for (const r of relations) {
    const key = `${normalizeEntityName(r.fromEntityName)}\0${normalizeEntityName(r.toEntityName)}\0${r.relationTypeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
};

/**
 * Truncates run-level merged lists after deduplication.
 *
 * @param entities - Deduped entities.
 * @param relations - Deduped relations.
 * @param maxEntitiesPerRun - Run cap on entities.
 * @param maxRelationsPerRun - Run cap on relations.
 * @returns Truncated copies.
 */
export const applyPerRunCaps = (
  entities: readonly EntityProposal[],
  relations: readonly RelationProposal[],
  maxEntitiesPerRun: number,
  maxRelationsPerRun: number,
): { entities: EntityProposal[]; relations: RelationProposal[] } => {
  const cappedEntities = entities.slice(0, maxEntitiesPerRun);

  const survivingNames = new Set<string>();
  for (const entity of cappedEntities) {
    survivingNames.add(normalizeEntityName(entity.canonicalName));
    for (const alias of entity.aliases) {
      survivingNames.add(normalizeEntityName(alias));
    }
  }

  const endpointFilteredRelations = relations.filter((relation) => {
    return (
      survivingNames.has(normalizeEntityName(relation.fromEntityName)) &&
      survivingNames.has(normalizeEntityName(relation.toEntityName))
    );
  });

  return {
    entities: cappedEntities,
    relations: endpointFilteredRelations.slice(0, maxRelationsPerRun),
  };
};
