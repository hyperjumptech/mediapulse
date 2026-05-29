/** @vitest-environment node */

import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { env } from "@hermes/env";

import type { ActivityRow } from "@/components/use-agent-activity-modal";

type AgentActivityClient = Pick<
  ReturnType<typeof createAgentDataApiClient>,
  "agentActivity"
>;

type GetAgentActivitiesDependencies = {
  getToken?: () => Promise<string>;
  createClient?: (token: string) => AgentActivityClient;
};

/**
 * Loads agent activity rows for a Hermes job from agent-data-api.
 * Returns an empty list when `AGENT_DATA_API_URL` is not configured.
 *
 * @param jobId - Hermes job id to query.
 * @param dependencies - Injectable token and client factories for tests.
 * @returns Activity rows ordered as returned by the data-api.
 */
export const getAgentActivities = async (
  jobId: string,
  dependencies: GetAgentActivitiesDependencies = {},
): Promise<ActivityRow[]> => {
  const baseUrl = env.AGENT_DATA_API_URL?.trim();
  if (!baseUrl) {
    return [];
  }

  const getToken =
    dependencies.getToken ??
    (async () =>
      createAgentTokenClient({
        authApiUrl: env.AGENT_AUTH_API_URL,
        credential: env.HERMES_INTERNAL_API_KEY,
      }).getToken());

  const createClient =
    dependencies.createClient ??
    ((token: string) =>
      createAgentDataApiClient({
        baseUrl,
        token,
      }));

  const token = await getToken();
  const client = createClient(token);
  const result = await client.agentActivity.get({ jobId });

  return result.data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
  }));
};
