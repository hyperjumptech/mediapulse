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

/** Newsletter language filter (`language` query param; matches users with any subscription in that language). */
export const languageSelectListFilter = {
  key: "language",
  label: "Language",
  ui: "select",
  placeholderAll: "All languages",
  staticOptions: [
    { value: "en", label: "English" },
    { value: "id", label: "Indonesian" },
  ],
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

/** Newsletter feedback sentiment filter (`sentiment` query param). */
export const feedbackSentimentSelectListFilter = {
  key: "sentiment",
  label: "Sentiment",
  ui: "select",
  placeholderAll: "All sentiments",
  staticOptions: [
    { value: "positive", label: "Positive" },
    { value: "negative", label: "Negative" },
    { value: "neutral", label: "Neutral" },
    { value: "mixed", label: "Mixed" },
  ],
} satisfies TableV1ListFilterDefinition;

/** Newsletter feedback category filter (`category` query param). */
export const feedbackCategorySelectListFilter = {
  key: "category",
  label: "Category",
  ui: "select",
  placeholderAll: "All categories",
  staticOptions: [
    { value: "praise", label: "Praise" },
    { value: "complaint", label: "Complaint" },
    { value: "feature_request", label: "Feature request" },
    { value: "bug", label: "Bug" },
    { value: "question", label: "Question" },
    { value: "other", label: "Other" },
  ],
} satisfies TableV1ListFilterDefinition;

/** Newsletter feedback received-date range filter (`from`/`to` query params). */
export const feedbackReceivedAtDateRangeListFilter = {
  key: "receivedAt",
  label: "Received",
  ui: "date-range",
  rangeParams: { from: "from", to: "to" },
} satisfies TableV1ListFilterDefinition;
