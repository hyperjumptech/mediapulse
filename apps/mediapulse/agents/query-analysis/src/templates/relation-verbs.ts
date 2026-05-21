/** Verb forms for a bounded KG `relationType` label. */
export type RelationVerbEntry = {
  verb: string;
  negativeVerb: string;
  pastVerb: string;
};

/** Static map from common relation types to searchable verb phrases. */
export const RELATION_VERB_MAP: Record<string, RelationVerbEntry> = {
  supplies: {
    verb: "supplies",
    negativeVerb: "stops supplying",
    pastVerb: "started supplying",
  },
  competes_with: {
    verb: "competes with",
    negativeVerb: "no longer competes with",
    pastVerb: "began competing with",
  },
  subsidiary_of: {
    verb: "is subsidiary of",
    negativeVerb: "is no longer subsidiary of",
    pastVerb: "became subsidiary of",
  },
  partners_with: {
    verb: "partners with",
    negativeVerb: "stops partnering with",
    pastVerb: "partnered with",
  },
  regulates: {
    verb: "regulates",
    negativeVerb: "stops regulating",
    pastVerb: "began regulating",
  },
  acquired_by: {
    verb: "was acquired by",
    negativeVerb: "is no longer owned by",
    pastVerb: "was acquired by",
  },
};

/**
 * Normalizes a relation type key for dictionary lookup.
 *
 * @param relationType - Raw KG relation label.
 * @returns Lowercase trimmed key.
 */
export const normalizeRelationTypeKey = (relationType: string): string =>
  relationType.trim().toLowerCase();

/**
 * Resolves the human-readable verb phrase for a relation edge.
 *
 * @param relationType - KG relation label (directional subject is `fromEntity`).
 * @param change - Optional delta change kind; neighborhood rows omit this.
 * @returns Verb phrase, falling back to the raw type with underscores as spaces.
 */
export const resolveRelationVerb = (
  relationType: string,
  change?: "added" | "removed" | "updated",
): string => {
  const key = normalizeRelationTypeKey(relationType);
  const entry = RELATION_VERB_MAP[key];
  if (!entry) {
    return relationType.trim().replace(/_/g, " ");
  }
  if (change === "removed") {
    return entry.negativeVerb;
  }
  if (change === "added") {
    return entry.pastVerb;
  }
  return entry.verb;
};
