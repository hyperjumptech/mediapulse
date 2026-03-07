import { z } from "zod";

export const AgentEndpointSchema = z.object({
  url: z.string().url(),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .optional()
    .default("POST"),
});

export type AgentEndpoint = z.infer<typeof AgentEndpointSchema>;

/** HTTP client interface for invoking agent endpoints (injectable for tests). */
export type InvokeAgentHttpClient = {
  post: (
    url: string,
    options: {
      json: Record<string, unknown>;
      headers: Record<string, string>;
      timeout?: { request: number };
    },
  ) => Promise<unknown>;
};

/**
 * Invokes an agent HTTP endpoint with the given params and job headers.
 *
 * @param endpoint - Parsed agent endpoint (url, method).
 * @param params - JSON body for the request.
 * @param options - Job IDs for headers, auth token, timeout.
 * @param httpClient - HTTP client (e.g. got).
 * @returns Resolves on success; throws on HTTP error.
 */
export const invokeAgent = async (
  endpoint: AgentEndpoint,
  params: Record<string, unknown>,
  options: {
    jobId: string;
    executionId: string;
    authToken?: string;
    timeoutMs?: number;
  },
  httpClient: InvokeAgentHttpClient,
): Promise<void> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Job-Id": options.jobId,
    "X-Execution-Id": options.executionId,
  };
  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }
  await httpClient.post(endpoint.url, {
    json: params,
    headers,
    timeout: options.timeoutMs ? { request: options.timeoutMs } : undefined,
  });
};
