import type { DetailBlockBadgeVariant } from "@hermes/domain-contract";
import type { SearchQuerySource } from "@mediapulse/database";

export type CollectionSource = "page-collection" | "data-collection";

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

export const COLLECTION_SOURCE_LABEL: Record<CollectionSource, string> = {
  "page-collection": "Page Collection",
  "data-collection": "Data Collection",
};

export const COLLECTION_SOURCE_BADGE_VARIANTS_BY_LABEL: Record<
  string,
  DetailBlockBadgeVariant
> = {
  "Page Collection": "success",
  "Data Collection": "outline",
};
