import type { AgentDetail } from "@/lib/agents";
import { fetchAgentTabContents } from "@/lib/domain-content-view";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { AgentDetailsContent } from "./agent-details-content";

const AGENT_TAB_CONTENTS_ERROR_MESSAGE =
  "Could not load integration tabs for this agent.";

const loadAgentTabContents = async (agent: AgentDetail) => {
  try {
    const agentTabContents = await fetchAgentTabContents(
      agent.domainIntegration.integrationId,
      agent.agentId,
    );

    return { agentTabContents, agentTabContentsError: undefined };
  } catch (error) {
    console.error(AGENT_TAB_CONTENTS_ERROR_MESSAGE, error);

    return {
      agentTabContents: [],
      agentTabContentsError: AGENT_TAB_CONTENTS_ERROR_MESSAGE,
    };
  }
};

export const AgentTabContentsSection = async ({
  agent,
}: {
  agent: AgentDetail;
}) => {
  const { agentTabContents, agentTabContentsError } = await withDashboardAdmin(
    loadAgentTabContents(agent),
  );

  return (
    <AgentDetailsContent
      agent={agent}
      agentTabContents={agentTabContents}
      agentTabContentsError={agentTabContentsError}
    />
  );
};
