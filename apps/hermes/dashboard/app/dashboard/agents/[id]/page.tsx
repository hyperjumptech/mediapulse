import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentById } from "@/lib/agents";
import { fetchAgentTabContents } from "@/lib/domain-content-view";

import { AgentDetailsContent } from "./agent-details-content";

/**
 * Agent detail page with optional domain-provided agent-tab views from the integration manifest.
 */
const AgentDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { id } = await params;
  await searchParams;

  const agent = await getAgentById(id);

  if (!agent) {
    notFound();
  }

  const agentTabContents = await fetchAgentTabContents(
    agent.domainIntegration.integrationId,
    agent.agentId,
  );

  return (
    <AgentDetailsContent agent={agent} agentTabContents={agentTabContents} />
  );
};

export default withAuthProtection(AgentDetailPage);
