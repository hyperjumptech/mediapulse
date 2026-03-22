import { z } from "zod";

export const AgentEndpointSchema = z.object({
  url: z.string().url(),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .optional()
    .default("POST"),
});

export type AgentEndpoint = z.infer<typeof AgentEndpointSchema>;

/**
 * HTTP response from the agent endpoint (transport layer only — status + raw body text).
 */
export type InvokeAgentHttpResponse = {
  statusCode: number;
  rawBody: string;
  isEmptyBody: boolean;
};

/** HTTP client interface for invoking agent endpoints (injectable for tests). */
export type InvokeAgentHttpClient = {
  post: (
    url: string,
    options: {
      json: Record<string, unknown>;
      headers: Record<string, string>;
      timeout?: { request: number };
      signal?: AbortSignal;
    },
  ) => Promise<InvokeAgentHttpResponse>;
};

/**
 * Result of attempting an HTTP POST to the agent: transport failure vs HTTP response.
 */
export type InvokeAgentPostResult =
  | { kind: "transport_error"; error: Error }
  | { kind: "http"; response: InvokeAgentHttpResponse };

/**
 * Sends JSON to the agent endpoint and returns status + raw body (no semantic parsing).
 * Transport failures (network, DNS) are returned as `transport_error` (do not throw).
 *
 * @param endpoint - Parsed agent endpoint (url, method).
 * @param params - JSON body for the request.
 * @param options - Job IDs for headers, auth token, timeout, optional abort signal.
 * @param httpClient - HTTP client (e.g. got with `throwHttpErrors: false`).
 */
export const invokeAgentPost = async (
  endpoint: AgentEndpoint,
  params: Record<string, unknown>,
  options: {
    jobId: string;
    executionId: string;
    authToken?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
  httpClient: InvokeAgentHttpClient,
): Promise<InvokeAgentPostResult> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Job-Id": options.jobId,
    "X-Execution-Id": options.executionId,
  };
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }
  try {
    const response = await httpClient.post(endpoint.url, {
      json: params,
      headers,
      timeout: options.timeoutMs ? { request: options.timeoutMs } : undefined,
      signal: options.signal,
    });
    return { kind: "http", response };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { kind: "transport_error", error };
  }
};

/**
 * @deprecated Prefer {@link invokeAgentPost} for response handling. Sends POST and throws on transport failure.
 */
export const invokeAgent = async (
  endpoint: AgentEndpoint,
  params: Record<string, unknown>,
  options: {
    jobId: string;
    executionId: string;
    authToken?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
  httpClient: InvokeAgentHttpClient,
): Promise<void> => {
  const result = await invokeAgentPost(endpoint, params, options, httpClient);
  if (result.kind === "transport_error") {
    throw result.error;
  }
};
