import {
  createAgentTokenClient,
  type FetchLike,
} from "@workspace/agent-auth-client";

/**
 * Registers this agent with the agent-registry-api so Hermes can discover and invoke it.
 * Call this on startup (or use createAgentApp's autoRegister option).
 *
 * Mints a short-lived JWT via agent-auth-api `POST /api/token` using a domain_integration API key,
 * then sends `Authorization: Bearer &lt;JWT&gt;` to the registry (same verification as agent invocation).
 *
 * @param params - Registry URL, auth API URL, domain integration id + API key, agent metadata, and JSON schemas.
 * @param params.fetchFn - Optional fetch for the registry POST (tests).
 * @param params.tokenFetchFn - Optional fetch for `POST /api/token` only (tests).
 */
export async function registerWithRegistry(params: {
  registryUrl: string;
  authApiUrl: string;
  domainIntegrationId: string;
  domainIntegrationApiKey: string;
  agentId: string;
  agentVersion: string;
  agentUrl: string;
  inputSchema: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  description?: string;
  fetchFn?: typeof fetch;
  tokenFetchFn?: FetchLike;
}): Promise<void> {
  const {
    registryUrl,
    authApiUrl,
    domainIntegrationId,
    domainIntegrationApiKey,
    agentId,
    agentVersion,
    agentUrl,
    inputSchema,
    configSchema,
    description,
    fetchFn = fetch,
    tokenFetchFn,
  } = params;

  const tokenClient = createAgentTokenClient({
    authApiUrl,
    credential: domainIntegrationApiKey,
    fetchFn: tokenFetchFn ?? fetch,
  });
  const jwt = await tokenClient.getToken();

  const url = `${registryUrl.replace(/\/$/, "")}/api/agents/register`;
  const body: Record<string, unknown> = {
    domainIntegrationId,
    agentId,
    agentVersion,
    endpoint: { url: agentUrl, method: "POST" },
    inputSchema,
    ...(configSchema != null ? { configSchema } : {}),
    ...(description != null ? { description } : {}),
  };

  const res = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Agent registry registration failed: ${res.status} ${text}`,
    );
  }
}
