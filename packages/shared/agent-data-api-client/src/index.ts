import {
  AGENT_DATA_API_DEFAULT_VERSION,
  agentDataApiManifestForVersion,
  agentDataApiPathname,
  type AgentDataApiFlatManifest,
  type AgentDataApiResourceKey,
  type AgentDataApiVersion,
} from "@workspace/agent-data-api-contract";
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

type AgentDataApiErrorWithContext = Error & {
  statusCode?: number;
  responseBody?: string;
};

type AgentDataApiClientOptions = {
  baseUrl: string;
  version?: AgentDataApiVersion;
  token?: string;
  getAuthHeader?: () => string | undefined;
  getFn?: DataApiGetFn;
  postFn?: DataApiPostFn;
};

type GetEndpointClient<T extends { get?: unknown }> = T extends {
  get: {
    query: infer TQuery extends z.ZodTypeAny;
    response: infer TResponse extends z.ZodTypeAny;
  };
}
  ? {
      get: (query: z.infer<TQuery>) => Promise<z.infer<TResponse>>;
    }
  : {};

type PostEndpointClient<T extends { post?: unknown }> = T extends {
  post: {
    body: infer TBody extends z.ZodTypeAny;
    response: infer TResponse extends z.ZodTypeAny;
  };
}
  ? {
      create: (body: z.infer<TBody>) => Promise<z.infer<TResponse>>;
    }
  : {};

type ManifestResourceClient<T extends { get?: unknown; post?: unknown }> =
  GetEndpointClient<T> & PostEndpointClient<T>;

export type AgentDataApiClient<
  TVersion extends AgentDataApiVersion = typeof AGENT_DATA_API_DEFAULT_VERSION,
> = {
  [K in AgentDataApiResourceKey]: ManifestResourceClient<
    AgentDataApiFlatManifest<TVersion>[K]
  >;
};

/**
 * Creates a typed SDK for the agent-data-api that validates responses with shared schemas.
 *
 * @param options - Base URL, auth, and optional transport dependencies.
 * @returns Namespaced endpoint methods for GET and POST operations.
 */
export const createAgentDataApiClient = <
  TVersion extends AgentDataApiVersion = typeof AGENT_DATA_API_DEFAULT_VERSION,
>(
  options: AgentDataApiClientOptions & { version?: TVersion },
): AgentDataApiClient<TVersion> => {
  const { baseUrl } = options;
  const version = (options.version ??
    AGENT_DATA_API_DEFAULT_VERSION) as TVersion;
  const manifest = agentDataApiManifestForVersion(version);
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
      throw createAgentDataApiError(res.statusCode, res.body);
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
      throw createAgentDataApiError(res.statusCode, res.body);
    }
    return schema.parse(JSON.parse(res.body));
  };

  /**
   * Builds a typed resource client with GET and POST methods from one manifest entry.
   *
   * @param resourceKey - Key in the shared API manifest.
   * @param resourceConfig - Manifest definition for a single API resource.
   * @returns Generated client namespace for the resource.
   */
  const buildResourceClient = <
    TResourceKey extends AgentDataApiResourceKey,
    TResourceConfig extends AgentDataApiFlatManifest<TVersion>[TResourceKey],
  >(
    resourceKey: TResourceKey,
    resourceConfig: TResourceConfig,
  ): ManifestResourceClient<TResourceConfig> => {
    const path = agentDataApiPathname(version, resourceKey);
    const resourceClient: Record<string, unknown> = {};
    const getConfig =
      resourceConfig && "get" in resourceConfig
        ? (resourceConfig.get as
            | { query: z.ZodTypeAny; response: z.ZodTypeAny }
            | undefined)
        : undefined;
    const postConfig =
      resourceConfig && "post" in resourceConfig
        ? (resourceConfig.post as
            | { body: z.ZodTypeAny; response: z.ZodTypeAny }
            | undefined)
        : undefined;

    if (getConfig) {
      resourceClient.get = (
        query: Record<string, string | number | boolean | undefined>,
      ) => getJson(path, query, getConfig.response);
    }

    if (postConfig) {
      resourceClient.create = (body: unknown) =>
        postJson(path, body, postConfig.response);
    }

    return resourceClient as ManifestResourceClient<TResourceConfig>;
  };

  const resourceKeys = Object.keys(manifest) as AgentDataApiResourceKey[];
  const client: Record<string, unknown> = {};

  for (const resourceKey of resourceKeys) {
    client[resourceKey] = buildResourceClient(
      resourceKey,
      manifest[resourceKey],
    );
  }

  return client as AgentDataApiClient<TVersion>;
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

/**
 * Builds an Error that preserves status and sanitized response body for debugging.
 *
 * The prefix `Agent data API error: <status>` remains stable so existing retry and
 * classification logic based on status parsing continues to work.
 *
 * @param statusCode - HTTP status returned by agent-data-api.
 * @param body - Raw response body text, if any.
 * @returns Error with message and structured context fields.
 */
const createAgentDataApiError = (
  statusCode: number,
  body: string | undefined,
): AgentDataApiErrorWithContext => {
  const compactBody = toCompactBody(body);
  const message =
    compactBody.length > 0
      ? `Agent data API error: ${statusCode} - ${compactBody}`
      : `Agent data API error: ${statusCode}`;
  const error = new Error(message) as AgentDataApiErrorWithContext;
  error.statusCode = statusCode;
  error.responseBody = compactBody.length > 0 ? compactBody : undefined;
  return error;
};

/**
 * Compacts and bounds response text to keep logs readable and safe.
 *
 * @param body - Raw HTTP response body.
 * @returns Single-line string truncated to a safe max length.
 */
const toCompactBody = (body: string | undefined): string => {
  if (!body) {
    return "";
  }
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.slice(0, 500);
};
