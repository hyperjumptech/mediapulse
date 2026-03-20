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

/**
 * Preserves literal manifest keys while validating each resource shape.
 *
 * @param manifest - Resource manifest keyed by resource identifier.
 * @returns The manifest with inferred literal key types.
 */
const defineAgentDataApiManifest = <
  TManifest extends Record<string, AgentDataApiResourceSchema>,
>(
  manifest: TManifest,
): TManifest => manifest;

/**
 * Shared prefix mounted by the agent-data-api service.
 */
export const AGENT_DATA_API_BASE_PATH = "/api" as const;

export const agentDataApiManifest = defineAgentDataApiManifest({
  contentGeneration: {
    get: {
      query: getContentGenerationQuerySchema,
      response: getContentGenerationResponseSchema,
    },
    post: {
      body: postContentGenerationBodySchema,
      response: postContentGenerationResponseSchema,
    },
  },
  dataCollection: {
    get: {
      query: dataCollectionQuerySchema,
      response: getDataCollectionResponseSchema,
    },
    post: {
      body: dataCollectionBodySchema,
      response: postDataCollectionResponseSchema,
    },
  },
  delivery: {
    get: {
      query: getDeliveryQuerySchema,
      response: getDeliveryResponseSchema,
    },
    post: {
      body: postDeliveryBodySchema,
      response: postDeliveryResponseSchema,
    },
  },
} as const);

export type AgentDataApiManifest = typeof agentDataApiManifest;
export type AgentDataApiResourceKey = keyof AgentDataApiManifest;

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
 * Returns the full pathname for a manifest resource.
 *
 * @param resourceKey - Manifest key for a resource.
 * @returns Full API pathname including base path and resource segment.
 */
export const agentDataApiPathname = (
  resourceKey: AgentDataApiResourceKey,
): string => {
  const resource = agentDataApiManifest[resourceKey];
  const pathSegment =
    "pathSegment" in resource && typeof resource.pathSegment === "string"
      ? resource.pathSegment
      : camelCaseResourceKeyToPathSegment(String(resourceKey));

  return `${AGENT_DATA_API_BASE_PATH}${pathSegment}`;
};
