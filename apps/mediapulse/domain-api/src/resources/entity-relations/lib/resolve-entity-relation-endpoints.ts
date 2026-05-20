/**
 * Resolves canonical entity and relation-type names to database ids for entity-relation writes.
 */

import type { prisma } from "@mediapulse/database";

/** Result of resolving endpoint names to foreign keys. */
export type EntityRelationEndpointIds = {
  fromEntityId: string;
  toEntityId: string;
  relationTypeId: string;
};

/** Failure while resolving a name to an id (client error). */
export type ResolveEntityRelationEndpointsError = {
  ok: false;
  message: string;
};

/** Success or validation failure from name resolution. */
export type ResolveEntityRelationEndpointsResult =
  | { ok: true; ids: EntityRelationEndpointIds }
  | ResolveEntityRelationEndpointsError;

type EntityDb = Pick<typeof prisma.entity, "findMany">;
type RelationTypeDb = Pick<typeof prisma.relationType, "findUnique">;

/**
 * Resolves a canonical entity name to a single entity id (case-insensitive).
 *
 * @param db - Prisma entity delegate (injected for tests).
 * @param canonicalName - Display name from the admin form.
 * @returns Entity id or an error message when missing or ambiguous.
 */
export const resolveEntityIdByCanonicalName = async (
  db: EntityDb,
  canonicalName: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> => {
  const trimmed = canonicalName.trim();
  const matches = await db.findMany({
    where: {
      canonicalName: { equals: trimmed, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (matches.length === 0) {
    return { ok: false, message: `Entity not found: ${trimmed}` };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      message: `Ambiguous entity name: ${trimmed}`,
    };
  }

  return { ok: true, id: matches[0]!.id };
};

/**
 * Resolves a relation type vocabulary name to its id.
 *
 * @param db - Prisma relationType delegate (injected for tests).
 * @param relationTypeName - Relation type label from the admin form.
 * @returns Relation type id or an error when the name is unknown.
 */
export const resolveRelationTypeIdByName = async (
  db: RelationTypeDb,
  relationTypeName: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> => {
  const trimmed = relationTypeName.trim();
  const row = await db.findUnique({
    where: { name: trimmed },
    select: { id: true },
  });

  if (!row) {
    return {
      ok: false,
      message: `Relation type not found: ${trimmed}`,
    };
  }

  return { ok: true, id: row.id };
};

/**
 * Resolves from/to entity names and relation type name for create or update payloads.
 *
 * @param db - Entity and relationType delegates (injected for tests).
 * @param input - Writable name fields from the Hermes form.
 * @returns Resolved foreign keys or the first resolution error.
 */
export const resolveEntityRelationEndpointIds = async (
  db: { entity: EntityDb; relationType: RelationTypeDb },
  input: {
    fromEntityName: string;
    toEntityName: string;
    relationTypeName: string;
  },
): Promise<ResolveEntityRelationEndpointsResult> => {
  const from = await resolveEntityIdByCanonicalName(
    db.entity,
    input.fromEntityName,
  );
  if (!from.ok) {
    return { ok: false, message: from.message };
  }

  const to = await resolveEntityIdByCanonicalName(
    db.entity,
    input.toEntityName,
  );
  if (!to.ok) {
    return { ok: false, message: to.message };
  }

  const relationType = await resolveRelationTypeIdByName(
    db.relationType,
    input.relationTypeName,
  );
  if (!relationType.ok) {
    return { ok: false, message: relationType.message };
  }

  return {
    ok: true,
    ids: {
      fromEntityId: from.id,
      toEntityId: to.id,
      relationTypeId: relationType.id,
    },
  };
};
