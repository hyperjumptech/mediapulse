/**
 * Registers this agent with the agent-registry-api so Hermes can discover and invoke it.
 * Call this on startup (or use createAgentApp's autoRegister option).
 *
 * @param params - Registry URL, API key, agent metadata, and JSON schemas.
 * @param params.fetchFn - Optional fetch implementation (for tests).
 */
export async function registerWithRegistry(params: {
  registryUrl: string;
  apiKey: string;
  agentId: string;
  agentVersion: string;
  agentUrl: string;
  inputSchema: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  description?: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  const {
    registryUrl,
    apiKey,
    agentId,
    agentVersion,
    agentUrl,
    inputSchema,
    configSchema,
    description,
    fetchFn = fetch,
  } = params;

  const url = `${registryUrl.replace(/\/$/, "")}/api/agents/register`;
  const body: Record<string, unknown> = {
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
      Authorization: `Bearer ${apiKey}`,
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
