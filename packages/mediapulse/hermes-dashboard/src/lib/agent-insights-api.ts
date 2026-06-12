import type { InsightsPayload } from "@workspace/agent-data-api-contract";
import { createAgentTokenClient } from "@workspace/agent-auth-client";

import type { MediapulseHermesDashboardRuntimeConfig } from "../config";
import { createMediapulseAgentDataApiClient } from "./agent-data-api-client";

type AgentInsightsClient = Pick<
  ReturnType<typeof createMediapulseAgentDataApiClient>,
  "agentInsights"
>;

type GetAgentInsightsParams = {
  agentId: string;
  window: "24h" | "7d" | "30d";
};

type GetAgentInsightsResult =
  | { payload: InsightsPayload; hasInsights: true }
  | { payload: null; hasInsights: false };

/**
 * Fetches agent insights for a given agent and time window.
 *
 * @param params - Agent ID and time window.
 * @param config - Runtime config with Hermes internal API key for JWT minting.
 * @param client - Injectable SDK client for tests.
 * @returns Insights payload when available, or a no-data sentinel.
 */
export const getAgentInsights = async (
  params: GetAgentInsightsParams,
  config: MediapulseHermesDashboardRuntimeConfig,
  client?: AgentInsightsClient,
): Promise<GetAgentInsightsResult> => {
  try {
    const resolvedClient =
      client ??
      (await (async () => {
        const tokenClient = createAgentTokenClient({
          authApiUrl: config.agentAuthApiUrl,
          credential: config.internalApiKey,
        });
        const jwt = await tokenClient.getToken();
        return createMediapulseAgentDataApiClient({
          agentDataApiUrl: config.agentDataApiUrl,
          internalApiKey: `Bearer ${jwt}`,
        });
      })());

    const payload = await resolvedClient.agentInsights.get({
      agentId: params.agentId,
      window: params.window,
    });

    return { payload, hasInsights: true };
  } catch {
    return { payload: null, hasInsights: false };
  }
};
