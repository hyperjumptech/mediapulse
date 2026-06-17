import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type {
  DataApiGetFn,
  DataApiPostFn,
} from "@workspace/agent-data-api-client";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { env } from "@mediapulse/env";

/**
 * Creates a pre-configured agent-data-api SDK client for Mediapulse domain-api content views.
 *
 * @param options - Optional transport overrides for tests.
 * @returns Typed SDK client for agent-data-api.
 */
export const createMediapulseAgentDataApiClient = async (options?: {
  getFn?: DataApiGetFn;
  postFn?: DataApiPostFn;
}) => {
  const baseUrl = env.AGENT_DATA_API_URL?.trim();
  const authApiUrl = env.AGENT_AUTH_API_URL?.trim();
  const credential = env.DOMAIN_INTEGRATION_API_KEY?.trim();
  if (!baseUrl || !authApiUrl || !credential) {
    throw new Error(
      "AGENT_DATA_API_URL, AGENT_AUTH_API_URL, and DOMAIN_INTEGRATION_API_KEY are required for operator content views",
    );
  }

  const jwt = await createAgentTokenClient({
    authApiUrl,
    credential,
  }).getToken();

  return createAgentDataApiClient({
    baseUrl,
    token: `Bearer ${jwt}`,
    getFn: options?.getFn,
    postFn: options?.postFn,
  });
};
