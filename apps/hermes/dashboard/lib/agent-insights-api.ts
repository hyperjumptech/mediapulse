import type { InsightsPayload } from "@workspace/agent-data-api-contract";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { env } from "@hermes/env";

import {
  createDashboardAgentDataApiClient,
} from "@/lib/agent-data-api-client";

type AgentInsightsClient = Pick<
  ReturnType<typeof createDashboardAgentDataApiClient>,
  "agentInsights"
>;

type GetAgentInsightsParams = {
  agentId: string;
  window: "24h" | "7d" | "30d";
};

type GetAgentInsightsResult =
  | { payload: InsightsPayload; hasInsights: true }
  | { payload: null; hasInsights: false };

let hermesTokenClient: ReturnType<typeof createAgentTokenClient> | null = null;

function getHermesTokenClient() {
  if (!hermesTokenClient && env.AGENT_AUTH_API_URL && env.HERMES_INTERNAL_API_KEY) {
    hermesTokenClient = createAgentTokenClient({
      authApiUrl: env.AGENT_AUTH_API_URL,
      credential: env.HERMES_INTERNAL_API_KEY,
    });
  }
  return hermesTokenClient;
}

async function buildInsightsClient(): Promise<AgentInsightsClient> {
  const tokenClient = getHermesTokenClient();
  if (tokenClient) {
    const jwt = await tokenClient.getToken();
    return createDashboardAgentDataApiClient({ token: `Bearer ${jwt}` });
  }
  return createDashboardAgentDataApiClient();
}

/**
 * Fetches agent insights for a given agent and time window.
 *
 * @param params - Agent ID and time window.
 * @param client - Injectable SDK client for tests.
 * @returns Insights payload when available, or a no-data sentinel.
 */
export const getAgentInsights = async (
  params: GetAgentInsightsParams,
  client?: AgentInsightsClient,
): Promise<GetAgentInsightsResult> => {
  try {
    const resolvedClient = client ?? await buildInsightsClient();
    const payload = await resolvedClient.agentInsights.get({
      agentId: params.agentId,
      window: params.window,
    });

    return { payload, hasInsights: true };
  } catch {
    return { payload: null, hasInsights: false };
  }
};
