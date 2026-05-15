import type { HermesMcpProfile } from "./profiles.js";

/** HTTP methods supported by Hermes MCP read tools. */
export type HermesHttpMethod = "GET" | "POST";

/** Options for a single Hermes HTTP request. */
export type HermesHttpRequest = {
  method: HermesHttpMethod;
  /** Path beginning with `/` (e.g. `/api/mcp/whoami`). */
  path: string;
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
};

/** Parsed Hermes HTTP response for MCP tool output. */
export type HermesHttpResponse = {
  status: number;
  body: unknown;
  text: string;
};

export type HermesHttpClient = {
  request: (request: HermesHttpRequest) => Promise<HermesHttpResponse>;
};

export type CreateHermesHttpClientDependencies = {
  getProfile: () => { profile: HermesMcpProfile } | { error: string };
  fetchImpl?: typeof fetch;
};

/**
 * Builds the request URL from profile base URL, path, and optional query params.
 *
 * @param profile - Active Hermes profile.
 * @param path - API path.
 * @param searchParams - Optional query string fields.
 * @returns Absolute request URL.
 */
export const buildHermesRequestUrl = (
  profile: HermesMcpProfile,
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): string => {
  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    profile.baseUrl,
  );

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
};

/**
 * Parses a fetch Response body as JSON when possible, otherwise as plain text.
 *
 * @param response - Fetch response.
 * @returns Parsed body and raw text.
 */
export const parseHermesResponseBody = async (
  response: Response,
): Promise<{ body: unknown; text: string }> => {
  const text = await response.text();
  if (!text) {
    return { body: null, text: "" };
  }

  try {
    return { body: JSON.parse(text) as unknown, text };
  } catch {
    return { body: text, text };
  }
};

/**
 * Redacts API keys from error messages so logs and tool output never leak secrets.
 *
 * @param message - Raw error message.
 * @param apiKey - Key to redact if present.
 * @returns Safe message.
 */
export const redactApiKeyFromMessage = (
  message: string,
  apiKey: string,
): string => {
  if (!apiKey) {
    return message;
  }
  return message.split(apiKey).join("[REDACTED]");
};

/**
 * Creates an HTTP client that calls Hermes with Bearer auth for the active profile.
 * Never logs the API key.
 *
 * @param dependencies - Profile resolver and fetch implementation (for tests).
 * @returns Client with a `request` method.
 */
export const createHermesHttpClient = ({
  getProfile,
  fetchImpl = fetch,
}: CreateHermesHttpClientDependencies): HermesHttpClient => {
  return {
    request: async (
      request: HermesHttpRequest,
    ): Promise<HermesHttpResponse> => {
      const resolved = getProfile();
      if ("error" in resolved) {
        return {
          status: 0,
          body: { error: resolved.error },
          text: JSON.stringify({ error: resolved.error }),
        };
      }

      const { profile } = resolved;
      const url = buildHermesRequestUrl(
        profile,
        request.path,
        request.searchParams,
      );

      const headers: Record<string, string> = {
        Authorization: `Bearer ${profile.apiKey}`,
        Accept: "application/json",
      };

      const init: RequestInit = {
        method: request.method,
        headers,
      };

      if (request.body !== undefined && request.method !== "GET") {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(request.body);
      }

      try {
        const response = await fetchImpl(url, init);
        const { body, text } = await parseHermesResponseBody(response);
        return { status: response.status, body, text };
      } catch (cause) {
        const message =
          cause instanceof Error
            ? redactApiKeyFromMessage(cause.message, profile.apiKey)
            : "Request failed";
        const payload = { error: message };
        return {
          status: 0,
          body: payload,
          text: JSON.stringify(payload),
        };
      }
    },
  };
};
