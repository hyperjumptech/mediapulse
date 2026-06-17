import type { TableV1ListFilterDefinition } from "@hermes/domain-contract";

/** Shared created-date range filter for table-v1 list pages. */
export const createdAtDateRangeListFilter = {
  key: "createdAt",
  label: "Created",
  ui: "date-range",
  rangeParams: { from: "from", to: "to" },
} satisfies TableV1ListFilterDefinition;

/** Ticker dropdown filter; options loaded from meta `filterOptions.tickerOptions`. */
export const tickerIdSelectListFilter = {
  key: "tickerId",
  label: "Ticker",
  ui: "select",
  placeholderAll: "All tickers",
  optionsMetaKey: "tickerOptions",
} satisfies TableV1ListFilterDefinition;

/** Entity type dropdown filter; options from meta `filterOptions.entityTypeOptions`. */
export const entityTypeIdSelectListFilter = {
  key: "typeId",
  label: "Type",
  ui: "select",
  placeholderAll: "All types",
  optionsMetaKey: "entityTypeOptions",
} satisfies TableV1ListFilterDefinition;

/** Active-set yes/no filter (`isActive` query param). */
export const isActiveBooleanSelectListFilter = {
  key: "isActive",
  label: "Active set",
  ui: "boolean-select",
} satisfies TableV1ListFilterDefinition;

/** Enabled yes/no filter (`enabled` query param). */
export const enabledBooleanSelectListFilter = {
  key: "enabled",
  label: "Enabled",
  ui: "boolean-select",
} satisfies TableV1ListFilterDefinition;

/** Intent dropdown filter for search queries. */
export const intentSelectListFilter = {
  key: "intent",
  label: "Intent",
  ui: "select",
  placeholderAll: "All intents",
  optionsMetaKey: "intentOptions",
} satisfies TableV1ListFilterDefinition;

/** Source dropdown filter for search queries. */
export const sourceSelectListFilter = {
  key: "source",
  label: "Source",
  ui: "select",
  placeholderAll: "All sources",
  optionsMetaKey: "sourceOptions",
} satisfies TableV1ListFilterDefinition;

/** Collection source dropdown filter for data sources. */
export const collectionSourceSelectListFilter = {
  key: "collectionSource",
  label: "Collected by",
  ui: "select",
  placeholderAll: "All",
  optionsMetaKey: "collectionSourceOptions",
} satisfies TableV1ListFilterDefinition;

/** Collection gate status filter for global page-collection articles. */
export const collectionGateStatusSelectListFilter = {
  key: "collectionGateStatus",
  label: "Gate status",
  ui: "select",
  placeholderAll: "All",
  optionsMetaKey: "collectionGateStatusOptions",
} satisfies TableV1ListFilterDefinition;
