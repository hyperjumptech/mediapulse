export {
  providerNameSchema,
  providerEntrySchema,
  localeSchema,
} from "./schemas";
export type { ProviderName, ProviderEntry, SearchLocale } from "./schemas";

export { createSearchProvider } from "./registry";
export { RESULTS_PER_QUERY, RECENCY_DAYS } from "./constants";

export type {
  SearchHit,
  SearchProvider,
  SearchProviderContext,
  SearchProviderLogger,
  SearchProviderResult,
} from "./types";

export { AllProvidersFailed, dispatch, RoundRobinCursor } from "./dispatch";
export type { DispatchProvider } from "./dispatch";

export { countQueryHits } from "./probe";
export type {
  CountQueryHitsContext,
  CountQueryHitsResult,
  CreditsSink,
} from "./probe";
