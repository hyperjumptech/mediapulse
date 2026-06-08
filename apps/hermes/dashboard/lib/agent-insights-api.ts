import type {
  InsightsPayload,
} from "@workspace/agent-data-api-contract";

import {
  createDashboardAgentDataApiClient,
  getDashboardAgentDataApiClient,
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

/**
 * Fetches agent insights for a given agent and time window.
 *
 * @param params - Agent ID and time window.
 * @param client - Injectable SDK client for tests.
 * @returns Insights payload when available, or a no-data sentinel.
 */
export const getAgentInsights = async (
  params: GetAgentInsightsParams,
  client: AgentInsightsClient = getDashboardAgentDataApiClient(),
): Promise<GetAgentInsightsResult> => {
  try {
    const payload = await client.agentInsights.get({
      agentId: params.agentId,
      window: params.window,
    });

    return { payload, hasInsights: true };
  } catch {
    return { payload: null, hasInsights: false };
  }
};
