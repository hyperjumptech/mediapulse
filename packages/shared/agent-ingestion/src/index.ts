export {
  RateLimiter,
  type StageThrottleStats,
  type RetryConfig,
  withRetry,
} from "./resilience";

export {
  classifyError,
  isRetryableError,
  type ClassifiedError,
} from "./error-classification";

export { pMap, type PMapOptions } from "./p-map";

export {
  createFetchProvider,
  createFetchProviderChain,
  type FetchProviderConfig,
} from "./fetch-providers/registry";

export {
  fetchProviderNameSchema,
  fetchProviderEntrySchema,
  expandFetchProviderEntry,
  expandFetchProviderEntries,
  type FetchProviderName,
  type FetchProviderEntry,
} from "./fetch-providers/schemas";

export type {
  FetchProvider,
  NormalizedFetchData,
  FetchProviderLogger,
  ProviderRequestContext,
} from "./fetch-providers/types";

export {
  performWebFetch,
  type WebFetchOutcome,
  type FetchedWebSearchResult,
  type WebFetchProviderName,
  type WebFetchFailure,
  type WebFetchDeps,
  type WebFetchLogger,
  type WebSearchResult,
} from "./web-fetch";

export {
  runQualityGate,
  classifyNonArticleContent,
  createEmptyQualityCounters,
  maxShingleFraction,
  type QualityDropReason,
  type QualityDecision,
  type ContentShapeDecision,
} from "./content-quality-gate";

export {
  createTickerRelevanceMatcher,
  buildRelevanceMatchText,
  type TickerRelevanceMatch,
  type TickerRelevanceMatcher,
} from "./ticker-relevance-gate";

export {
  isJunkTitle,
  hasSufficientDescription,
  normalizeTitleKey,
  createTitleDeduper,
  MIN_DESCRIPTION_CHARS,
  type CollectionGateDropReason,
  type TitleDeduper,
} from "./collection-gates";

export {
  isFresh,
  type FreshnessDecision,
  type FreshnessGateConfig,
} from "./freshness-gate";

export {
  extractPublishedDate,
  extractDateFromUrl,
  extractFromRelativeAge,
  type FetchMetadata,
  type ExtractPublishedDateInput,
} from "./date-extractor";

export {
  HostErrorTracker,
  hostFromUrl,
  buildDeadUrlRecords,
  type QualityDropForDeadUrl,
} from "./host-error-tracker";

export { resolveDeadUrls, type LookupDeadUrls } from "./resolve-dead-urls";

export {
  resolveExistingDataSourceUrls,
  type LookupExistingDataSourceUrls,
  type ExistingDataSourceLookupResult,
} from "./resolve-existing-data-source-urls";

export {
  toDataSources,
  type CollectedPageForSource,
  type DataCollectionSource,
} from "./data-sources";

export {
  deriveRunStatus,
  type RunStatus,
  type RunPolicy,
  type RunCounters,
} from "./run-status";

export { createListingDiscoveryStrategy } from "./discovery/registry";

export {
  discoverOneSource,
  runDiscovery,
  type DiscoveryCache,
  type DiscoverySource,
  type DiscoveryFailure,
  type SourceDiscoveryOutcome,
  type SourceDiscoveryReport,
  type RunDiscoveryResult,
} from "./discovery/run-discovery";

export {
  type DiscoveredItem,
  type ListingDiscoveryStrategy,
  type DiscoveryDeps,
  type DiscoveryLogger,
} from "./discovery/types";

export {
  describeOutcomeReason,
  makeCollectedOutcome,
  makeDroppedOutcome,
  makeFailedOutcome,
  postOutcomesInChunks,
  REASON_LABELS,
  type CollectionUrlOutcomeInput,
  type CollectionUrlOutcomeReason,
} from "./collection-url-outcome";
