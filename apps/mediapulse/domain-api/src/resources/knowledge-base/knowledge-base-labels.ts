/** Reader-facing names for the entity kinds. */
const ENTITY_KIND_LABELS: Record<string, string> = {
  issuer: "Issuer",
  company: "Company",
  brand: "Brand",
  regulator: "Regulator",
  government: "Government",
  person: "Person",
  product: "Product",
  place: "Place",
  other: "Other",
};

/** Reader-facing names for how a fact entered the knowledge base. */
const FACT_SOURCE_LABELS: Record<string, string> = {
  profile: "Ticker Profile",
  extracted: "Extracted from an article",
  operator: "Operator",
};

/**
 * Names an entity kind for display.
 *
 * @param kind - Stored kind.
 */
export const kindLabel = (kind: string): string =>
  ENTITY_KIND_LABELS[kind] ?? kind;

/**
 * Names a fact's origin for display.
 *
 * @param source - Stored source.
 */
export const sourceLabel = (source: string): string =>
  FACT_SOURCE_LABELS[source] ?? source;

/** The palette group a node takes, which is the entity kind narrowed to what the legend shows. */
export const GRAPH_GROUP_BY_KIND: Record<string, string> = {
  issuer: "ticker",
  company: "company",
  brand: "company",
  regulator: "regulator",
  government: "regulator",
  person: "person",
  product: "other",
  place: "other",
  other: "other",
};

/**
 * Groups an entity kind for the graph palette.
 *
 * @param kind - Stored kind.
 */
export const graphGroupForKind = (kind: string): string =>
  GRAPH_GROUP_BY_KIND[kind] ?? "other";

/** Longest title drawn inside a graph node before it is cut. */
export const GRAPH_TITLE_CHARS = 80;

/**
 * Shortens a title for a graph node or a table cell.
 *
 * @param title - Title as stored.
 * @param limit - Longest string to keep.
 */
export const truncateTitle = (
  title: string,
  limit: number = GRAPH_TITLE_CHARS,
): string =>
  title.length <= limit ? title : `${title.slice(0, limit - 1).trimEnd()}…`;

/**
 * Describes how many articles a graph is standing on.
 *
 * @param entityCount - Entities drawn.
 * @param articleCount - Articles drawn.
 */
export const graphSummary = (
  entityCount: number,
  articleCount: number,
): string =>
  `${String(entityCount)} entities, ${String(articleCount)} articles`;
