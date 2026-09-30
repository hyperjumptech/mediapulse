import type { DashboardView } from "@hermes/domain-contract";

import { getAgentById, type AgentDetail } from "@/lib/agents";
import { filterAgentTabViewsForAgent } from "@/lib/domain-content-view";
import {
  getDomainIntegrationByIntegrationId,
  type DomainIntegrationRecord,
} from "@/lib/domain-integrations";

export type AgentTabViewSummary = {
  integrationId: string;
  viewId: string;
  label: string;
  kind: DashboardView["kind"];
};

export type AgentDetailApiDependencies = {
  getAgent: (id: string) => Promise<AgentDetail | null>;
  getIntegration: (
    integrationId: string,
  ) => Promise<DomainIntegrationRecord | null>;
};

const defaultDependencies: AgentDetailApiDependencies = {
  getAgent: (id) => getAgentById(id),
  getIntegration: (integrationId) =>
    getDomainIntegrationByIntegrationId(integrationId),
};

const summarizeAgentTabViews = (
  integration: DomainIntegrationRecord | null,
  agentId: string,
): AgentTabViewSummary[] =>
  integration
    ? filterAgentTabViewsForAgent(integration.dashboard.views, agentId).map(
        (view) => ({
          integrationId: integration.integrationId,
          viewId: view.id,
          label: view.tabLabel ?? view.label,
          kind: view.kind,
        }),
      )
    : [];

export const getAgentDetailForApi = async (
  id: string,
  dependencies: AgentDetailApiDependencies = defaultDependencies,
) => {
  const agent = await dependencies.getAgent(id);
  if (!agent) {
    return null;
  }
  const integration = await dependencies.getIntegration(
    agent.domainIntegration.integrationId,
  );

  return {
    ...agent,
    agentTabViews: summarizeAgentTabViews(integration, agent.agentId),
  };
};
