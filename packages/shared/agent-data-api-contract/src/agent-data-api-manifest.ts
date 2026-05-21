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
  postContentGenerationBodySchema,
  postContentGenerationResponseSchema,
} from "./content-generation.js";
import {
  dataCollectionBodySchema,
  dataCollectionQuerySchema,
  getDataCollectionResponseSchema,
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
  userRegistrationUnsubscribeQuerySchema,
  userRegistrationUnsubscribeResponseSchema,
} from "./user-registration.js";
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
