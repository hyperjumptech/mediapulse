import type { ArticleMentionProposal } from "../analysis-article-mentions.js";
import type {
  EntityProposal,
  RelationProposal,
} from "../analysis-vocabulary.js";
import { normalizeEntityName } from "../normalize-entity-name.js";

/** How ungrounded entities are handled after LLM extraction. */
export type EntityGroundingPolicy = "drop" | "flag" | "off";

/** Result of verifying one entity against article title and body. */
export type EntityGroundingResult = {
  grounded: boolean;
  matchedAlias: string | null;
  matchedIn: "title" | "body" | null;
};

/** Per-source counters emitted when grounding filters extraction output. */
export type PerSourceGroundingCounters = {
  ungroundedEntityCount: number;
  relationsDroppedDueToUngroundedEndpoint: number;
  mentionsDroppedDueToUngroundedEntity: number;
};

/** Run-level grounding totals for observability. */
export type GroundingObservabilityAggregate = {
  entitiesUngroundedTotal: number;
  relationsDroppedTotal: number;
  mentionsDroppedTotal: number;
};

/** Max mention confidence for ungrounded entities under the `flag` policy. */
export const FLAG_POLICY_MAX_MENTION_CONFIDENCE = 0.4;

const CORPORATE_SUFFIXES = [
  "Inc",
  "Inc.",
  "Corp",
  "Corp.",
  "Ltd",
  "Ltd.",
  "LLC",
  "LLC.",
  "plc",
  "S.A.",
] as const;

/**
 * Returns zeroed run-level grounding counters.
 */
export const createEmptyGroundingTotals = (): GroundingObservabilityAggregate => ({
  entitiesUngroundedTotal: 0,
  relationsDroppedTotal: 0,
  mentionsDroppedTotal: 0,
});

/**
 * Adds per-source grounding counters into run-level totals.
 *
 * @param totals - Mutable aggregate updated in place.
 * @param counters - Counters from one source.
 */
export const accumulateGroundingCounters = (
  totals: GroundingObservabilityAggregate,
  counters: PerSourceGroundingCounters,
): void => {
  totals.entitiesUngroundedTotal += counters.ungroundedEntityCount;
  totals.relationsDroppedTotal +=
    counters.relationsDroppedDueToUngroundedEndpoint;
  totals.mentionsDroppedTotal += counters.mentionsDroppedDueToUngroundedEntity;
};

/**
 * Returns whether a name should use exact matching only (no suffix/whitespace loosening).
 *
 * @param name - Candidate entity name or alias.
 */
export const isAcronymName = (name: string): boolean => {
  const trimmed = name.trim();
  if (trimmed.length <= 3) {
    return true;
  }
  return trimmed.length > 0 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
};

/**
 * Collapses internal whitespace to a single space and trims ends.
 *
 * @param value - Raw string.
 */
export const collapseInnerWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

/**
 * Strips trailing corporate suffix tokens from an entity name.
 *
 * @param name - Raw entity name or alias.
 */
export const stripCorporateSuffixes = (name: string): string => {
  let result = name.trim();
  for (const suffix of CORPORATE_SUFFIXES) {
    const escaped = suffix.replaceAll(".", "\\.");
    const pattern = new RegExp(`\\s+${escaped}$`, "i");
    result = result.replace(pattern, "").trim();
  }
  return result;
};

/**
 * Normalizes text for grounding substring checks (trim, lowercase, collapsed whitespace).
 *
 * @param value - Raw string from the article or entity label.
 */
export const normalizeForGroundingMatch = (value: string): string =>
  normalizeEntityName(collapseInnerWhitespace(value));

/**
 * Finds an exact normalized substring of `name` inside `haystack`.
 *
 * @param name - Needle entity name or alias.
 * @param haystack - Title or body text.
 * @returns The original-casing matched span from `haystack`, or `null`.
 */
export const findExactNormalizedSubstring = (
  name: string,
  haystack: string,
): string | null => {
  const needle = normalizeForGroundingMatch(name);
  if (needle.length === 0) {
    return null;
  }
  const normalizedHaystack = normalizeForGroundingMatch(haystack);
  const index = normalizedHaystack.indexOf(needle);
  if (index === -1) {
    return null;
  }
  return haystack.slice(index, index + needle.length);
};

/**
 * Performs relaxed grounding match: exact substring, optional suffix strip, whitespace collapse.
 * Acronyms use exact normalized substring only.
 *
 * @param name - Entity canonical name or alias to locate.
 * @param haystack - Title or article body text.
 * @returns Matched span from `haystack`, or `null` when no rule matches.
 */
export const isLooseMatch = (name: string, haystack: string): string | null => {
  const exact = findExactNormalizedSubstring(name, haystack);
  if (exact !== null) {
    return exact;
  }

  if (isAcronymName(name)) {
    return null;
  }

  const suffixStripped = stripCorporateSuffixes(name);
  if (suffixStripped !== name.trim()) {
    const strippedMatch = findExactNormalizedSubstring(suffixStripped, haystack);
    if (strippedMatch !== null) {
      return strippedMatch;
    }
  }

  const collapsedHaystack = normalizeForGroundingMatch(haystack);
  const needle = normalizeForGroundingMatch(name);
  if (needle.length > 0 && collapsedHaystack.includes(needle)) {
    return name.trim();
  }

  const strippedNeedle = normalizeForGroundingMatch(suffixStripped);
  if (
    strippedNeedle.length > 0 &&
    strippedNeedle !== needle &&
    collapsedHaystack.includes(strippedNeedle)
  ) {
    return suffixStripped;
  }

  return null;
};

/**
 * Verifies whether an extracted entity appears in the article title or full body.
 *
 * @param params - Entity proposal, full article text, title, and optional title-hit requirement.
 */
export const verifyEntityGrounding = (params: {
  entity: EntityProposal;
  articleText: string;
  title: string;
  entityGroundingMinTitleHits?: number;
}): EntityGroundingResult => {
  const candidates = [
    params.entity.canonicalName,
    ...params.entity.aliases,
  ];
  let bodyMatch: { alias: string } | null = null;
  let titleMatch: { alias: string } | null = null;

  for (const alias of candidates) {
    if (bodyMatch === null && isLooseMatch(alias, params.articleText) !== null) {
      bodyMatch = { alias };
    }
    if (titleMatch === null && isLooseMatch(alias, params.title) !== null) {
      titleMatch = { alias };
    }
  }

  const minTitleHits = params.entityGroundingMinTitleHits ?? 0;
  if (minTitleHits > 0) {
    if (titleMatch === null) {
      return { grounded: false, matchedAlias: null, matchedIn: null };
    }
    return {
      grounded: true,
      matchedAlias: titleMatch.alias,
      matchedIn: "title",
    };
  }

  if (bodyMatch !== null) {
    return {
      grounded: true,
      matchedAlias: bodyMatch.alias,
      matchedIn: "body",
    };
  }
  if (titleMatch !== null) {
    return {
      grounded: true,
      matchedAlias: titleMatch.alias,
      matchedIn: "title",
    };
  }

  return { grounded: false, matchedAlias: null, matchedIn: null };
};

/**
 * Builds the normalized set of grounded entity canonical names.
 *
 * @param entities - Extracted entities.
 * @param articleText - Full article body (not truncated prompt text).
 * @param title - Article title.
 * @param entityGroundingMinTitleHits - Strict title requirement when greater than zero.
 */
export const buildGroundedCanonicalNameSet = (
  entities: readonly EntityProposal[],
  articleText: string,
  title: string,
  entityGroundingMinTitleHits: number,
): Set<string> => {
  const grounded = new Set<string>();
  for (const entity of entities) {
    const result = verifyEntityGrounding({
      entity,
      articleText,
      title,
      entityGroundingMinTitleHits,
    });
    if (result.grounded) {
      grounded.add(normalizeEntityName(entity.canonicalName));
    }
  }
  return grounded;
};

/**
 * Applies post-extraction entity grounding to entities, relations, and mentions.
 *
 * @param params - Raw LLM extraction slice, policy knobs, and article ground-truth text.
 */
export const applyExtractionEntityGrounding = (params: {
  entities: readonly EntityProposal[];
  relations: readonly RelationProposal[];
  mentions: readonly ArticleMentionProposal[];
  articleText: string;
  title: string;
  policy: EntityGroundingPolicy;
  entityGroundingMinTitleHits: number;
}): {
  entities: EntityProposal[];
  relations: RelationProposal[];
  mentions: ArticleMentionProposal[];
  counters: PerSourceGroundingCounters;
} => {
  if (params.policy === "off") {
    return {
      entities: [...params.entities],
      relations: [...params.relations],
      mentions: [...params.mentions],
      counters: {
        ungroundedEntityCount: 0,
        relationsDroppedDueToUngroundedEndpoint: 0,
        mentionsDroppedDueToUngroundedEntity: 0,
      },
    };
  }

  const groundedNames = buildGroundedCanonicalNameSet(
    params.entities,
    params.articleText,
    params.title,
    params.entityGroundingMinTitleHits,
  );

  const groundedEntities: EntityProposal[] = [];
  const flaggedEntities: EntityProposal[] = [];
  let ungroundedEntityCount = 0;

  for (const entity of params.entities) {
    const isGrounded = groundedNames.has(
      normalizeEntityName(entity.canonicalName),
    );
    if (isGrounded) {
      groundedEntities.push(entity);
      continue;
    }
    ungroundedEntityCount += 1;
    if (params.policy === "flag") {
      flaggedEntities.push(entity);
    }
  }

  const entitiesAfterPolicy =
    params.policy === "drop"
      ? groundedEntities
      : [...groundedEntities, ...flaggedEntities];

  const relationsAfterGrounding: RelationProposal[] = [];
  let relationsDroppedDueToUngroundedEndpoint = 0;
  for (const relation of params.relations) {
    const fromGrounded = groundedNames.has(
      normalizeEntityName(relation.fromEntityName),
    );
    const toGrounded = groundedNames.has(
      normalizeEntityName(relation.toEntityName),
    );
    if (fromGrounded && toGrounded) {
      relationsAfterGrounding.push(relation);
    } else {
      relationsDroppedDueToUngroundedEndpoint += 1;
    }
  }

  const mentionsAfterGrounding: ArticleMentionProposal[] = [];
  let mentionsDroppedDueToUngroundedEntity = 0;
  for (const mention of params.mentions) {
    const mentionGrounded = groundedNames.has(
      normalizeEntityName(mention.entityName),
    );
    if (!mentionGrounded) {
      if (params.policy === "flag") {
        mentionsAfterGrounding.push({
          ...mention,
          confidence: Math.min(
            mention.confidence,
            FLAG_POLICY_MAX_MENTION_CONFIDENCE,
          ),
        });
        continue;
      }
      mentionsDroppedDueToUngroundedEntity += 1;
      continue;
    }
    mentionsAfterGrounding.push(mention);
  }

  return {
    entities: entitiesAfterPolicy,
    relations: relationsAfterGrounding,
    mentions: mentionsAfterGrounding,
    counters: {
      ungroundedEntityCount,
      relationsDroppedDueToUngroundedEndpoint,
      mentionsDroppedDueToUngroundedEntity,
    },
  };
};
