import {
  getAnalysisResponseSchema,
  getContentGenerationResponseSchema,
  getDeliveryResponseSchema,
  getQueryAnalysisResponseSchema,
  postAnalysisResponseSchema,
  postContentGenerationResponseSchema,
  postDeliveryResponseSchema,
  postQueryAnalysisResponseSchema,
  type GetAnalysisQuery,
  type GetAnalysisResponse,
  type GetContentGenerationQuery,
  type GetContentGenerationResponse,
  type GetDeliveryQuery,
  type GetDeliveryResponse,
  type GetQueryAnalysisQuery,
  type GetQueryAnalysisResponse,
  type PostAnalysisBody,
  type PostAnalysisResponse,
  type PostContentGenerationBody,
  type PostContentGenerationResponse,
  type PostDeliveryBody,
  type PostDeliveryResponse,
  type PostQueryAnalysisBody,
  type PostQueryAnalysisResponse,
} from "@workspace/agent-data-api-contract";
import {
  type DataCollectionBody,
  type DataCollectionQuery,
} from "@workspace/agent-types";
import got from "got";
import { z } from "zod";

export type GetResponse = { body: string; statusCode: number };
export type PostResponse = { body: string; statusCode: number };

export type DataApiGetFn = (
  url: string,
  options?: { headers?: Record<string, string>; throwHttpErrors?: boolean },
) => Promise<GetResponse>;

export type DataApiPostFn = (
  url: string,
  options?: {
    json?: unknown;
    headers?: Record<string, string>;
    throwHttpErrors?: boolean;
  },
) => Promise<PostResponse>;

const getDataCollectionResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
      tickerId: z.string().uuid(),
    }),
  ),
});
const postDataCollectionResponseSchema = z.object({
  message: z.string(),
});

export type GetDataCollectionResponse = z.infer<
  typeof getDataCollectionResponseSchema
>;
export type PostDataCollectionResponse = z.infer<
  typeof postDataCollectionResponseSchema
>;

export type AgentDataApiClient = ReturnType<typeof createAgentDataApiClient>;

type AgentDataApiClientOptions = {
  baseUrl: string;
  token?: string;
  getAuthHeader?: () => string | undefined;
  getFn?: DataApiGetFn;
  postFn?: DataApiPostFn;
};

/**
 * Creates a typed SDK for the agent-data-api that validates responses with shared schemas.
 *
 * @param options - Base URL, auth, and optional transport dependencies.
 * @returns Namespaced endpoint methods for GET and POST operations.
 */
export const createAgentDataApiClient = (
  options: AgentDataApiClientOptions,
) => {
  const { baseUrl } = options;
  const resolveAuthHeader = () => options.getAuthHeader?.() ?? options.token;

  const getJson = async <T>(
    path: string,
    query: Record<string, string | number | boolean | undefined>,
    schema: z.ZodType<T>,
  ): Promise<T> => {
    const url = new URL(baseUrl);
    url.pathname = path.startsWith("/") ? path : `/${path}`;
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await (options.getFn ?? defaultGet)(url.toString(), {
      headers: buildAuthHeaders(resolveAuthHeader()),
      throwHttpErrors: false,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`Agent data API error: ${res.statusCode}`);
    }
    return schema.parse(JSON.parse(res.body));
  };

  const postJson = async <T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> => {
    const url = new URL(baseUrl);
    url.pathname = path.startsWith("/") ? path : `/${path}`;

    const res = await (options.postFn ?? defaultPost)(url.toString(), {
      json: body,
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(resolveAuthHeader()),
      },
      throwHttpErrors: false,
    });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new Error(`Agent data API error: ${res.statusCode}`);
    }
    return schema.parse(JSON.parse(res.body));
  };

  return {
    analysis: {
      get: (query: GetAnalysisQuery): Promise<GetAnalysisResponse> =>
        getJson("/api/analysis", query, getAnalysisResponseSchema),
      create: (body: PostAnalysisBody): Promise<PostAnalysisResponse> =>
        postJson("/api/analysis", body, postAnalysisResponseSchema),
    },
    queryAnalysis: {
      get: (query: GetQueryAnalysisQuery): Promise<GetQueryAnalysisResponse> =>
        getJson("/api/query-analysis", query, getQueryAnalysisResponseSchema),
      create: (
        body: PostQueryAnalysisBody,
      ): Promise<PostQueryAnalysisResponse> =>
        postJson("/api/query-analysis", body, postQueryAnalysisResponseSchema),
    },
    contentGeneration: {
      get: (
        query: GetContentGenerationQuery,
      ): Promise<GetContentGenerationResponse> =>
        getJson(
          "/api/content-generation",
          query,
          getContentGenerationResponseSchema,
        ),
      create: (
        body: PostContentGenerationBody,
      ): Promise<PostContentGenerationResponse> =>
        postJson(
          "/api/content-generation",
          body,
          postContentGenerationResponseSchema,
        ),
    },
    dataCollection: {
      get: (query: DataCollectionQuery): Promise<GetDataCollectionResponse> =>
        getJson("/api/data-collection", query, getDataCollectionResponseSchema),
      create: (body: DataCollectionBody): Promise<PostDataCollectionResponse> =>
        postJson(
          "/api/data-collection",
          body,
          postDataCollectionResponseSchema,
        ),
    },
    delivery: {
      get: (query: GetDeliveryQuery): Promise<GetDeliveryResponse> =>
        getJson("/api/delivery", query, getDeliveryResponseSchema),
      create: (body: PostDeliveryBody): Promise<PostDeliveryResponse> =>
        postJson("/api/delivery", body, postDeliveryResponseSchema),
    },
  };
};

/**
 * Builds an Authorization header object when a token exists.
 *
 * @param token - Bearer token or undefined.
 * @returns Header record suitable for got options.
 */
const buildAuthHeaders = (
  token: string | undefined,
): Record<string, string> | undefined =>
  token ? { Authorization: token } : undefined;

/**
 * Executes a default GET request through got.
 *
 * @param url - Absolute endpoint URL.
 * @param opts - Optional headers and got flags.
 * @returns Response body and status code.
 */
const defaultGet = async (
  url: string,
  opts?: { headers?: Record<string, string>; throwHttpErrors?: boolean },
): Promise<GetResponse> => {
  const res = await got.get(url, {
    headers: opts?.headers,
    throwHttpErrors: opts?.throwHttpErrors ?? false,
  });
  return { body: res.body, statusCode: res.statusCode ?? 200 };
};

/**
 * Executes a default POST request through got.
 *
 * @param url - Absolute endpoint URL.
 * @param opts - Optional JSON payload and headers.
 * @returns Response body and status code.
 */
const defaultPost = async (
  url: string,
  opts?: {
    json?: unknown;
    headers?: Record<string, string>;
    throwHttpErrors?: boolean;
  },
): Promise<PostResponse> => {
  const res = await got.post(url, {
    json: opts?.json,
    headers: opts?.headers,
    throwHttpErrors: opts?.throwHttpErrors ?? false,
  });
  return { body: res.body, statusCode: res.statusCode ?? 200 };
};
