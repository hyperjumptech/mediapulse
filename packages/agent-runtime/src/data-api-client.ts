import got from "got";

/** Response shape from an HTTP get call (e.g. got). */
export type GetResponse = { body: string; statusCode: number };

/** Response shape from an HTTP post call (e.g. got). */
export type PostResponse = { body: string; statusCode: number };

/** Optional HTTP client for GET (injectable for tests). */
export type DataApiGetFn = (
  url: string,
  options?: { headers?: Record<string, string>; throwHttpErrors?: boolean },
) => Promise<GetResponse>;

/** Optional HTTP client for POST (injectable for tests). */
export type DataApiPostFn = (
  url: string,
  options?: {
    json?: unknown;
    headers?: Record<string, string>;
    throwHttpErrors?: boolean;
  },
) => Promise<PostResponse>;

/**
 * GET from the agent-data-api at baseUrl + path with optional query params.
 * Uses the given token as Authorization header. Returns parsed JSON.
 *
 * @param token - Authorization header value (e.g. "Bearer <key>"); omitted if undefined.
 * @param baseUrl - Base URL of the agent-data-api (no trailing slash).
 * @param path - Path (e.g. "/api/delivery").
 * @param query - Optional query params.
 * @param options - Optional getFn for DI (defaults to got.get).
 * @returns Parsed JSON response body.
 * @throws When the response is not ok (statusCode not 2xx) unless throwHttpErrors is false.
 */
export async function dataApiGet<T = unknown>(
  token: string | undefined,
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
  options?: { getFn?: DataApiGetFn },
): Promise<T> {
  const url = new URL(baseUrl);
  url.pathname = path.startsWith("/") ? path : `/${path}`;
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  const getFn = options?.getFn ?? defaultGet;
  const res = await getFn(url.toString(), {
    headers: token ? { Authorization: token } : undefined,
    throwHttpErrors: false,
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Agent data API error: ${res.statusCode}`);
  }
  return JSON.parse(res.body) as T;
}

/**
 * POST to the agent-data-api at baseUrl + path with JSON body.
 * Uses the given token as Authorization header.
 *
 * @param token - Authorization header value; omitted if undefined.
 * @param baseUrl - Base URL of the agent-data-api.
 * @param path - Path (e.g. "/api/delivery").
 * @param body - JSON-serializable body.
 * @param options - Optional postFn for DI (defaults to got.post).
 * @returns The response body as string (caller may parse if needed).
 * @throws When the response is not ok.
 */
export async function dataApiPost(
  token: string | undefined,
  baseUrl: string,
  path: string,
  body: unknown,
  options?: { postFn?: DataApiPostFn },
): Promise<string> {
  const url = new URL(baseUrl);
  url.pathname = path.startsWith("/") ? path : `/${path}`;
  const postFn = options?.postFn ?? defaultPost;
  const res = await postFn(url.toString(), {
    json: body,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    throwHttpErrors: false,
  });
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`Agent data API error: ${res.statusCode}`);
  }
  return res.body;
}

async function defaultGet(
  url: string,
  opts?: { headers?: Record<string, string>; throwHttpErrors?: boolean },
): Promise<GetResponse> {
  const res = await got.get(url, {
    headers: opts?.headers,
    throwHttpErrors: opts?.throwHttpErrors ?? false,
  });
  return { body: res.body, statusCode: res.statusCode ?? 200 };
}

async function defaultPost(
  url: string,
  opts?: {
    json?: unknown;
    headers?: Record<string, string>;
    throwHttpErrors?: boolean;
  },
): Promise<PostResponse> {
  const res = await got.post(url, {
    json: opts?.json,
    headers: opts?.headers,
    throwHttpErrors: opts?.throwHttpErrors ?? false,
  });
  return { body: res.body, statusCode: res.statusCode ?? 200 };
}
