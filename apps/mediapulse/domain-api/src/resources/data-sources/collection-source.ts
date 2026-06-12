import type { DetailBlockBadgeVariant } from "@hermes/domain-contract";
import type { Prisma, SearchQuerySource } from "@mediapulse/database";
import { z } from "zod";

export type CollectionSource = "page-collection" | "data-collection";

/** Zod schema for `collectionSource` list filter query values. */
export const collectionSourceSchema = z.enum([
  "page-collection",
  "data-collection",
]);

export const COLLECTION_SOURCE_LABEL: Record<CollectionSource, string> = {
  "page-collection": "Page Collection",
  "data-collection": "Data Collection",
};

/** Dropdown options for the Hermes `collectionSource` list filter (from GET meta). */
export const COLLECTION_SOURCE_OPTIONS = (
  Object.entries(COLLECTION_SOURCE_LABEL) as Array<[CollectionSource, string]>
).map(([value, label]) => ({ value, label }));

export const classifyCollectionSource = (
  source: SearchQuerySource,
): CollectionSource => {
  switch (source) {
    case "curated":
      return "page-collection";
    case "deterministic":
    case "llm":
      return "data-collection";
  }
};

export const COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL: Record<
  string,
  DetailBlockBadgeVariant
> = {
  "Page Collection": "success",
  "Data Collection": "outline",
};

/**
 * Builds a Prisma `where` clause on {@link SearchQuery} for a collection source filter.
 *
 * @param collectionSource - Page collection (curated) or data collection (deterministic/llm).
 * @returns A `Prisma.SearchQueryWhereInput` restricting `source`.
 */
export const buildCollectionSourceSearchQueryWhere = (
  collectionSource: CollectionSource,
): Prisma.SearchQueryWhereInput => {
  switch (collectionSource) {
    case "page-collection":
      return { source: "curated" };
    case "data-collection":
      return { source: { in: ["deterministic", "llm"] } };
  }
};
