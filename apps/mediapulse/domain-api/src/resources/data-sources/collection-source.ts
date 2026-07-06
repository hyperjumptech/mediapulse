import type { DetailBlockBadgeVariant } from "@hermes/domain-contract";
import type { Prisma } from "@mediapulse/database";
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

/**
 * Classifies a data source by its collection origin.
 *
 * Data-collection articles are attributed to a generated search query; page-collection
 * articles come from a curated listing and carry no search query.
 *
 * @param hasSearchQuery - Whether the data source is linked to a search query.
 * @returns `data-collection` when a search query is present, otherwise `page-collection`.
 */
export const classifyCollectionSource = (
  hasSearchQuery: boolean,
): CollectionSource => (hasSearchQuery ? "data-collection" : "page-collection");

export const COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL: Record<
  string,
  DetailBlockBadgeVariant
> = {
  "Page Collection": "success",
  "Data Collection": "outline",
};

/**
 * Builds a Prisma `where` clause on {@link DataSource} for a collection source filter.
 *
 * @param collectionSource - Page collection (no search query) or data collection (has a search query).
 * @returns A `Prisma.DataSourceWhereInput` restricting on search-query linkage.
 */
export const buildCollectionSourceDataSourceWhere = (
  collectionSource: CollectionSource,
): Prisma.DataSourceWhereInput => {
  switch (collectionSource) {
    case "page-collection":
      return { searchQueryId: null };
    case "data-collection":
      return { searchQueryId: { not: null } };
  }
};
