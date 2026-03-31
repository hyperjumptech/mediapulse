import { z } from "zod";
import {
  getContentGenerationQuerySchema,
  getContentGenerationResponseSchema,
  postContentGenerationBodySchema,
  postContentGenerationResponseSchema,
} from "./content-generation.js";
import {
  dataCollectionBodySchema,
  dataCollectionQuerySchema,
  getDataCollectionResponseSchema,
  postDataCollectionResponseSchema,
} from "./data-collection.js";
import {
  getDeliveryQuerySchema,
  getDeliveryResponseSchema,
  postDeliveryBodySchema,
  postDeliveryResponseSchema,
} from "./delivery.js";
import {
  getQueryAnalysisQuerySchema,
  getQueryAnalysisResponseSchema,
  postQueryAnalysisBodySchema,
  postQueryAnalysisResponseSchema,
} from "./query-analysis.js";
import {
  postUserRegistrationRegisterBodySchema,
  postUserRegistrationRegisterResponseSchema,
  postUserRegistrationConfirmBodySchema,
  postUserRegistrationConfirmResponseSchema,
} from "./user-registration.js";

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
