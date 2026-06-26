import { z } from "zod";
import {
  getAnalysisQuerySchema,
  getAnalysisResponseSchema,
  postAnalysisBodySchema,
  postAnalysisResponseSchema,
} from "./analysis.js";
import {
  postAnalysisDataSourceDeleteBodySchema,
  postAnalysisDataSourceDeleteResponseSchema,
} from "./analysis-data-source-delete.js";
import {
  getContentGenerationQuerySchema,
  getContentGenerationResponseSchema,
  getContentGenerationNewslettersLatestQuerySchema,
  getContentGenerationNewslettersLatestResponseSchema,
  getContentGenerationNewslettersRecentQuerySchema,
  getContentGenerationNewslettersRecentResponseSchema,
  getContentGenerationBulletsRecentQuerySchema,
  getContentGenerationBulletsRecentResponseSchema,
  postContentGenerationBodySchema,
  postContentGenerationResponseSchema,
} from "./content-generation.js";
import {
  dataCollectionBodySchema,
  dataCollectionQuerySchema,
  getDataCollectionResponseSchema,
  postCuratedListingQueryBodySchema,
  postCuratedListingQueryResponseSchema,
  postDataCollectionExistingUrlsBodySchema,
  postDataCollectionExistingUrlsResponseSchema,
  postDataCollectionResponseSchema,
} from "./data-collection.js";
import {
  postDataCollectionDeadUrlsLookupBodySchema,
  postDataCollectionDeadUrlsLookupResponseSchema,
  postDataCollectionDeadUrlsRecordBodySchema,
  postDataCollectionDeadUrlsRecordResponseSchema,
} from "./data-collection-dead-url.js";
import {
  postListingDiscoveryCacheLookupBodySchema,
  postListingDiscoveryCacheLookupResponseSchema,
  postListingDiscoveryCacheRecordBodySchema,
  postListingDiscoveryCacheRecordResponseSchema,
} from "./listing-discovery-cache.js";
import {
  postDiscoverySourceHealthRecordBodySchema,
  postDiscoverySourceHealthRecordResponseSchema,
  postDiscoverySourceHealthGetBodySchema,
  postDiscoverySourceHealthGetResponseSchema,
} from "./discovery-source-health.js";
import {
  getDataCollectionRecentSourceFingerprintsQuerySchema,
  getDataCollectionRecentSourceFingerprintsResponseSchema,
} from "./data-collection.js";
import {
  deliveryRunQuerySchema,
  getDeliveryRunResponseSchema,
  postDeliveryRunBodySchema,
  postDeliveryRunResponseSchema,
} from "./delivery-run.js";
import {
  getDeliveryQuerySchema,
  getDeliveryResponseSchema,
  postDeliveryBodySchema,
  postDeliveryResponseSchema,
} from "./delivery.js";
import {
  deliveryClaimBodySchema,
  postDeliveryClaimResponseSchema,
  postDeliveryClaimReleaseResponseSchema,
} from "./delivery-claim.js";
import {
  dataCollectionRunQuerySchema,
  getDataCollectionRunResponseSchema,
  postDataCollectionRunBodySchema,
  postDataCollectionRunResponseSchema,
} from "./data-collection-run.js";
import {
  dataCollectionFailureQuerySchema,
  getDataCollectionFailureResponseSchema,
  postDataCollectionFailureBodySchema,
  postDataCollectionFailureResponseSchema,
} from "./data-collection-failure.js";
import {
  getUserRegistrationTickersQuerySchema,
  getUserRegistrationTickersResponseSchema,
  postUserRegistrationRegisterBodySchema,
  postUserRegistrationRegisterResponseSchema,
  postUserRegistrationConfirmBodySchema,
  postUserRegistrationConfirmResponseSchema,
  postUserRegistrationUnsubscribeBodySchema,
  postUserRegistrationWebSignupBodySchema,
  postUserRegistrationWebSignupResponseSchema,
  userRegistrationConfirmSubscriptionQuerySchema,
  userRegistrationConfirmSubscriptionResponseSchema,
  userRegistrationUnsubscribeQuerySchema,
  userRegistrationUnsubscribeResponseSchema,
} from "./user-registration.js";
import {
  postNewsletterFeedbackRecordBodySchema,
  postNewsletterFeedbackRecordResponseSchema,
} from "./newsletter-feedback.js";
import {
  contentGenerationRunQuerySchema,
  getContentGenerationRunResponseSchema,
  postContentGenerationRunBodySchema,
  postContentGenerationRunResponseSchema,
} from "./content-generation-run.js";
import {
  getQueryAnalysisQuerySchema,
  getQueryAnalysisResponseSchema,
  postQueryAnalysisBodySchema,
  postQueryAnalysisResponseSchema,
} from "./query-analysis.js";
import { getTickerQuerySchema, getTickerResponseSchema } from "./ticker.js";
import {
  getSectionCoverageRollupQuerySchema,
  getSectionCoverageRollupResponseSchema,
} from "./section-coverage-rollup.js";
import {
  getAgentInsightsQuerySchema,
  getAgentInsightsResponseSchema,
} from "./agent-insights.js";
import {
  postCollectionUrlOutcomeBodySchema,
  postCollectionUrlOutcomeResponseSchema,
} from "./collection-url-outcome.js";
import {
  getPageCollectionArticlesQuerySchema,
  getPageCollectionArticlesResponseSchema,
  postPageCollectionBodySchema,
  postPageCollectionExistingUrlsBodySchema,
  postPageCollectionExistingUrlsResponseSchema,
  postPageCollectionResolveSourcesBodySchema,
  postPageCollectionResolveSourcesResponseSchema,
  postPageCollectionResponseSchema,
} from "./page-collection.js";

type AgentDataApiMethodSchema =
  | {
      query: z.ZodTypeAny;
      response: z.ZodTypeAny;
    }
  | {
      body: z.ZodTypeAny;
      response: z.ZodTypeAny;
    };

type AgentDataApiResourceSchema = {
  pathSegment?: string;
  get?: Extract<AgentDataApiMethodSchema, { query: z.ZodTypeAny }>;
  post?: Extract<AgentDataApiMethodSchema, { body: z.ZodTypeAny }>;
};

export const AGENT_DATA_API_LIVE_VERSIONS = ["v1", "v2"] as const;
export type AgentDataApiVersion = (typeof AGENT_DATA_API_LIVE_VERSIONS)[number];

/**
 * Preserves literal manifest keys while validating each resource shape.
 *
 * @param manifest - Resource manifest keyed by resource identifier.
 * @returns The manifest with inferred literal key types.
 */
const defineAgentDataApiManifest = <
  TManifest extends Record<
    string,
    Record<AgentDataApiVersion, AgentDataApiResourceSchema>
  >,
>(
  manifest: TManifest,
): TManifest => manifest;

/**
 * Shared API prefix mounted by the agent-data-api service.
 */
export const AGENT_DATA_API_PREFIX = "/api" as const;

/**
 * Default API version used by SDK consumers unless explicitly overridden.
 */
export const AGENT_DATA_API_DEFAULT_VERSION = "v1" as const;

export const agentDataApiManifest = defineAgentDataApiManifest({
  analysis: {
    v1: {
      get: {
        query: getAnalysisQuerySchema,
        response: getAnalysisResponseSchema,
      },
      post: {
        body: postAnalysisBodySchema,
        response: postAnalysisResponseSchema,
      },
    },
    v2: {
      get: {
        query: getAnalysisQuerySchema,
        response: getAnalysisResponseSchema,
      },
      post: {
        body: postAnalysisBodySchema,
        response: postAnalysisResponseSchema,
      },
    },
  },
  analysisDataSourceDelete: {
    v1: {
      post: {
        body: postAnalysisDataSourceDeleteBodySchema,
        response: postAnalysisDataSourceDeleteResponseSchema,
      },
    },
    v2: {
      post: {
        body: postAnalysisDataSourceDeleteBodySchema,
        response: postAnalysisDataSourceDeleteResponseSchema,
      },
    },
  },
  contentGeneration: {
    v1: {
      get: {
        query: getContentGenerationQuerySchema,
        response: getContentGenerationResponseSchema,
      },
      post: {
        body: postContentGenerationBodySchema,
        response: postContentGenerationResponseSchema,
      },
    },
    v2: {
      get: {
        query: getContentGenerationQuerySchema,
        response: getContentGenerationResponseSchema,
      },
      post: {
        body: postContentGenerationBodySchema,
        response: postContentGenerationResponseSchema,
      },
    },
  },
  contentGenerationNewslettersLatest: {
    v1: {
      get: {
        query: getContentGenerationNewslettersLatestQuerySchema,
        response: getContentGenerationNewslettersLatestResponseSchema,
      },
    },
    v2: {
      get: {
        query: getContentGenerationNewslettersLatestQuerySchema,
        response: getContentGenerationNewslettersLatestResponseSchema,
      },
    },
  },
  contentGenerationNewslettersRecent: {
    v1: {
      get: {
        query: getContentGenerationNewslettersRecentQuerySchema,
        response: getContentGenerationNewslettersRecentResponseSchema,
      },
    },
    v2: {
      get: {
        query: getContentGenerationNewslettersRecentQuerySchema,
        response: getContentGenerationNewslettersRecentResponseSchema,
      },
    },
  },
  contentGenerationBulletsRecent: {
    v1: {
      get: {
        query: getContentGenerationBulletsRecentQuerySchema,
        response: getContentGenerationBulletsRecentResponseSchema,
      },
    },
    v2: {
      get: {
        query: getContentGenerationBulletsRecentQuerySchema,
        response: getContentGenerationBulletsRecentResponseSchema,
      },
    },
  },
  dataCollection: {
    v1: {
      get: {
        query: dataCollectionQuerySchema,
        response: getDataCollectionResponseSchema,
      },
      post: {
        body: dataCollectionBodySchema,
        response: postDataCollectionResponseSchema,
      },
    },
    v2: {
      get: {
        query: dataCollectionQuerySchema,
        response: getDataCollectionResponseSchema,
      },
      post: {
        body: dataCollectionBodySchema,
        response: postDataCollectionResponseSchema,
      },
    },
  },
  dataCollectionExistingUrls: {
    v1: {
      post: {
        body: postDataCollectionExistingUrlsBodySchema,
        response: postDataCollectionExistingUrlsResponseSchema,
      },
    },
    v2: {
      post: {
        body: postDataCollectionExistingUrlsBodySchema,
        response: postDataCollectionExistingUrlsResponseSchema,
      },
    },
  },
  dataCollectionDeadUrlsLookup: {
    v1: {
      pathSegment: "/data-collection/dead-urls/lookup",
      post: {
        body: postDataCollectionDeadUrlsLookupBodySchema,
        response: postDataCollectionDeadUrlsLookupResponseSchema,
      },
    },
    v2: {
      pathSegment: "/data-collection/dead-urls/lookup",
      post: {
        body: postDataCollectionDeadUrlsLookupBodySchema,
        response: postDataCollectionDeadUrlsLookupResponseSchema,
      },
    },
  },
  dataCollectionDeadUrlsRecord: {
    v1: {
      pathSegment: "/data-collection/dead-urls/record",
      post: {
        body: postDataCollectionDeadUrlsRecordBodySchema,
        response: postDataCollectionDeadUrlsRecordResponseSchema,
      },
    },
    v2: {
      pathSegment: "/data-collection/dead-urls/record",
      post: {
        body: postDataCollectionDeadUrlsRecordBodySchema,
        response: postDataCollectionDeadUrlsRecordResponseSchema,
      },
    },
  },
  dataCollectionRecentSourceFingerprints: {
    v1: {
      pathSegment: "/data-collection/recent-source-fingerprints",
      get: {
        query: getDataCollectionRecentSourceFingerprintsQuerySchema,
        response: getDataCollectionRecentSourceFingerprintsResponseSchema,
      },
    },
    v2: {
      pathSegment: "/data-collection/recent-source-fingerprints",
      get: {
        query: getDataCollectionRecentSourceFingerprintsQuerySchema,
        response: getDataCollectionRecentSourceFingerprintsResponseSchema,
      },
    },
  },
  dataCollectionCuratedListingQuery: {
    v1: {
      pathSegment: "/data-collection/curated-listing-query",
      post: {
        body: postCuratedListingQueryBodySchema,
        response: postCuratedListingQueryResponseSchema,
      },
    },
    v2: {
      pathSegment: "/data-collection/curated-listing-query",
      post: {
        body: postCuratedListingQueryBodySchema,
        response: postCuratedListingQueryResponseSchema,
      },
    },
  },
  dataCollectionRun: {
    v1: {
      get: {
        query: dataCollectionRunQuerySchema,
        response: getDataCollectionRunResponseSchema,
      },
      post: {
        body: postDataCollectionRunBodySchema,
        response: postDataCollectionRunResponseSchema,
      },
    },
    v2: {
      get: {
        query: dataCollectionRunQuerySchema,
        response: getDataCollectionRunResponseSchema,
      },
      post: {
        body: postDataCollectionRunBodySchema,
        response: postDataCollectionRunResponseSchema,
      },
    },
  },
  dataCollectionFailure: {
    v1: {
      get: {
        query: dataCollectionFailureQuerySchema,
        response: getDataCollectionFailureResponseSchema,
      },
      post: {
        body: postDataCollectionFailureBodySchema,
        response: postDataCollectionFailureResponseSchema,
      },
    },
    v2: {
      get: {
        query: dataCollectionFailureQuerySchema,
        response: getDataCollectionFailureResponseSchema,
      },
      post: {
        body: postDataCollectionFailureBodySchema,
        response: postDataCollectionFailureResponseSchema,
      },
    },
  },
  delivery: {
    v1: {
      get: {
        query: getDeliveryQuerySchema,
        response: getDeliveryResponseSchema,
      },
      post: {
        body: postDeliveryBodySchema,
        response: postDeliveryResponseSchema,
      },
    },
    v2: {
      get: {
        query: getDeliveryQuerySchema,
        response: getDeliveryResponseSchema,
      },
      post: {
        body: postDeliveryBodySchema,
        response: postDeliveryResponseSchema,
      },
    },
  },

  deliveryClaim: {
    v1: {
      post: {
        body: deliveryClaimBodySchema,
        response: postDeliveryClaimResponseSchema,
      },
    },
    v2: {
      post: {
        body: deliveryClaimBodySchema,
        response: postDeliveryClaimResponseSchema,
      },
    },
  },

  deliveryClaimRelease: {
    v1: {
      post: {
        body: deliveryClaimBodySchema,
        response: postDeliveryClaimReleaseResponseSchema,
      },
    },
    v2: {
      post: {
        body: deliveryClaimBodySchema,
        response: postDeliveryClaimReleaseResponseSchema,
      },
    },
  },

  deliveryRun: {
    v1: {
      get: {
        query: deliveryRunQuerySchema,
        response: getDeliveryRunResponseSchema,
      },
      post: {
        body: postDeliveryRunBodySchema,
        response: postDeliveryRunResponseSchema,
      },
    },
    v2: {
      get: {
        query: deliveryRunQuerySchema,
        response: getDeliveryRunResponseSchema,
      },
      post: {
        body: postDeliveryRunBodySchema,
        response: postDeliveryRunResponseSchema,
      },
    },
  },
  queryAnalysis: {
    v1: {
      get: {
        query: getQueryAnalysisQuerySchema,
        response: getQueryAnalysisResponseSchema,
      },
      post: {
        body: postQueryAnalysisBodySchema,
        response: postQueryAnalysisResponseSchema,
      },
    },
    v2: {
      get: {
        query: getQueryAnalysisQuerySchema,
        response: getQueryAnalysisResponseSchema,
      },
      post: {
        body: postQueryAnalysisBodySchema,
        response: postQueryAnalysisResponseSchema,
      },
    },
  },
  ticker: {
    v1: {
      get: {
        query: getTickerQuerySchema,
        response: getTickerResponseSchema,
      },
    },
    v2: {
      get: {
        query: getTickerQuerySchema,
        response: getTickerResponseSchema,
      },
    },
  },
  contentGenerationRuns: {
    v1: {
      get: {
        query: contentGenerationRunQuerySchema,
        response: getContentGenerationRunResponseSchema,
      },
      post: {
        body: postContentGenerationRunBodySchema,
        response: postContentGenerationRunResponseSchema,
      },
    },
    v2: {
      get: {
        query: contentGenerationRunQuerySchema,
        response: getContentGenerationRunResponseSchema,
      },
      post: {
        body: postContentGenerationRunBodySchema,
        response: postContentGenerationRunResponseSchema,
      },
    },
  },
  userRegistrationRegister: {
    v1: {
      post: {
        body: postUserRegistrationRegisterBodySchema,
        response: postUserRegistrationRegisterResponseSchema,
      },
    },
    v2: {
      post: {
        body: postUserRegistrationRegisterBodySchema,
        response: postUserRegistrationRegisterResponseSchema,
      },
    },
  },
  newsletterFeedbackRecord: {
    v1: {
      post: {
        body: postNewsletterFeedbackRecordBodySchema,
        response: postNewsletterFeedbackRecordResponseSchema,
      },
    },
    v2: {
      post: {
        body: postNewsletterFeedbackRecordBodySchema,
        response: postNewsletterFeedbackRecordResponseSchema,
      },
    },
  },
  userRegistrationConfirm: {
    v1: {
      post: {
        body: postUserRegistrationConfirmBodySchema,
        response: postUserRegistrationConfirmResponseSchema,
      },
    },
    v2: {
      post: {
        body: postUserRegistrationConfirmBodySchema,
        response: postUserRegistrationConfirmResponseSchema,
      },
    },
  },
  userRegistrationUnsubscribe: {
    v1: {
      get: {
        query: userRegistrationUnsubscribeQuerySchema,
        response: userRegistrationUnsubscribeResponseSchema,
      },
      post: {
        body: postUserRegistrationUnsubscribeBodySchema,
        response: userRegistrationUnsubscribeResponseSchema,
      },
    },
    v2: {
      get: {
        query: userRegistrationUnsubscribeQuerySchema,
        response: userRegistrationUnsubscribeResponseSchema,
      },
      post: {
        body: postUserRegistrationUnsubscribeBodySchema,
        response: userRegistrationUnsubscribeResponseSchema,
      },
    },
  },
  userRegistrationTickers: {
    v1: {
      get: {
        query: getUserRegistrationTickersQuerySchema,
        response: getUserRegistrationTickersResponseSchema,
      },
    },
    v2: {
      get: {
        query: getUserRegistrationTickersQuerySchema,
        response: getUserRegistrationTickersResponseSchema,
      },
    },
  },
  userRegistrationWebSignup: {
    v1: {
      post: {
        body: postUserRegistrationWebSignupBodySchema,
        response: postUserRegistrationWebSignupResponseSchema,
      },
    },
    v2: {
      post: {
        body: postUserRegistrationWebSignupBodySchema,
        response: postUserRegistrationWebSignupResponseSchema,
      },
    },
  },
  userRegistrationConfirmSubscription: {
    v1: {
      get: {
        query: userRegistrationConfirmSubscriptionQuerySchema,
        response: userRegistrationConfirmSubscriptionResponseSchema,
      },
    },
    v2: {
      get: {
        query: userRegistrationConfirmSubscriptionQuerySchema,
        response: userRegistrationConfirmSubscriptionResponseSchema,
      },
    },
  },
  sectionCoverageRollup: {
    v1: {
      get: {
        query: getSectionCoverageRollupQuerySchema,
        response: getSectionCoverageRollupResponseSchema,
      },
    },
    v2: {
      get: {
        query: getSectionCoverageRollupQuerySchema,
        response: getSectionCoverageRollupResponseSchema,
      },
    },
  },
  listingDiscoveryCacheLookup: {
    v1: {
      pathSegment: "/listing-discovery-cache/lookup",
      post: {
        body: postListingDiscoveryCacheLookupBodySchema,
        response: postListingDiscoveryCacheLookupResponseSchema,
      },
    },
    v2: {
      pathSegment: "/listing-discovery-cache/lookup",
      post: {
        body: postListingDiscoveryCacheLookupBodySchema,
        response: postListingDiscoveryCacheLookupResponseSchema,
      },
    },
  },
  listingDiscoveryCacheRecord: {
    v1: {
      pathSegment: "/listing-discovery-cache/record",
      post: {
        body: postListingDiscoveryCacheRecordBodySchema,
        response: postListingDiscoveryCacheRecordResponseSchema,
      },
    },
    v2: {
      pathSegment: "/listing-discovery-cache/record",
      post: {
        body: postListingDiscoveryCacheRecordBodySchema,
        response: postListingDiscoveryCacheRecordResponseSchema,
      },
    },
  },
  discoverySourceHealthRecord: {
    v1: {
      pathSegment: "/discovery-source-health/record",
      post: {
        body: postDiscoverySourceHealthRecordBodySchema,
        response: postDiscoverySourceHealthRecordResponseSchema,
      },
    },
    v2: {
      pathSegment: "/discovery-source-health/record",
      post: {
        body: postDiscoverySourceHealthRecordBodySchema,
        response: postDiscoverySourceHealthRecordResponseSchema,
      },
    },
  },
  discoverySourceHealthGet: {
    v1: {
      pathSegment: "/discovery-source-health/get",
      post: {
        body: postDiscoverySourceHealthGetBodySchema,
        response: postDiscoverySourceHealthGetResponseSchema,
      },
    },
    v2: {
      pathSegment: "/discovery-source-health/get",
      post: {
        body: postDiscoverySourceHealthGetBodySchema,
        response: postDiscoverySourceHealthGetResponseSchema,
      },
    },
  },
  agentInsights: {
    v1: {
      get: {
        query: getAgentInsightsQuerySchema,
        response: getAgentInsightsResponseSchema,
      },
    },
    v2: {
      get: {
        query: getAgentInsightsQuerySchema,
        response: getAgentInsightsResponseSchema,
      },
    },
  },
  collectionUrlOutcome: {
    v1: {
      post: {
        body: postCollectionUrlOutcomeBodySchema,
        response: postCollectionUrlOutcomeResponseSchema,
      },
    },
    v2: {
      post: {
        body: postCollectionUrlOutcomeBodySchema,
        response: postCollectionUrlOutcomeResponseSchema,
      },
    },
  },
  pageCollection: {
    v1: {
      post: {
        body: postPageCollectionBodySchema,
        response: postPageCollectionResponseSchema,
      },
    },
    v2: {
      post: {
        body: postPageCollectionBodySchema,
        response: postPageCollectionResponseSchema,
      },
    },
  },
  pageCollectionExistingUrls: {
    v1: {
      post: {
        body: postPageCollectionExistingUrlsBodySchema,
        response: postPageCollectionExistingUrlsResponseSchema,
      },
    },
    v2: {
      post: {
        body: postPageCollectionExistingUrlsBodySchema,
        response: postPageCollectionExistingUrlsResponseSchema,
      },
    },
  },
  pageCollectionResolveSources: {
    v1: {
      pathSegment: "/page-collection/resolve-sources",
      post: {
        body: postPageCollectionResolveSourcesBodySchema,
        response: postPageCollectionResolveSourcesResponseSchema,
      },
    },
    v2: {
      pathSegment: "/page-collection/resolve-sources",
      post: {
        body: postPageCollectionResolveSourcesBodySchema,
        response: postPageCollectionResolveSourcesResponseSchema,
      },
    },
  },
  pageCollectionArticles: {
    v1: {
      pathSegment: "/page-collection/articles",
      get: {
        query: getPageCollectionArticlesQuerySchema,
        response: getPageCollectionArticlesResponseSchema,
      },
    },
    v2: {
      pathSegment: "/page-collection/articles",
      get: {
        query: getPageCollectionArticlesQuerySchema,
        response: getPageCollectionArticlesResponseSchema,
      },
    },
  },
} as const);

export type AgentDataApiManifest = typeof agentDataApiManifest;
export type AgentDataApiResourceKey = keyof AgentDataApiManifest;
export type AgentDataApiFlatManifest<
  TVersion extends AgentDataApiVersion = AgentDataApiVersion,
> = {
  [K in AgentDataApiResourceKey]: AgentDataApiManifest[K][TVersion];
};

/**
 * Converts a camelCase resource key into a kebab-case URL segment.
 *
 * @param resourceKey - Resource key in camelCase.
 * @returns Segment string that always starts with a slash.
 */
export const camelCaseResourceKeyToPathSegment = (
  resourceKey: string,
): string =>
  `/${resourceKey.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;

/**
 * Returns a flat manifest for one API version.
 *
 * @param version - Version key to slice from the nested manifest.
 * @returns Per-resource route definitions for the requested version.
 */
export const agentDataApiManifestForVersion = <
  TVersion extends AgentDataApiVersion,
>(
  version: TVersion,
): AgentDataApiFlatManifest<TVersion> => {
  const resourceKeys = Object.keys(
    agentDataApiManifest,
  ) as AgentDataApiResourceKey[];
  const entries = resourceKeys.map((resourceKey) => [
    resourceKey,
    agentDataApiManifest[resourceKey][version],
  ]);

  return Object.fromEntries(entries) as AgentDataApiFlatManifest<TVersion>;
};

/**
 * Returns the full pathname for a manifest resource.
 *
 * @param version - API version for the request path.
 * @param resourceKey - Manifest key for a resource.
 * @returns Full API pathname including prefix, version, and resource segment.
 */
export const agentDataApiPathname = (
  version: AgentDataApiVersion,
  resourceKey: AgentDataApiResourceKey,
): string => {
  const resource = agentDataApiManifest[resourceKey][version];
  const pathSegment =
    "pathSegment" in resource && typeof resource.pathSegment === "string"
      ? resource.pathSegment
      : camelCaseResourceKeyToPathSegment(String(resourceKey));

  return `${AGENT_DATA_API_PREFIX}/${version}${pathSegment}`;
};
