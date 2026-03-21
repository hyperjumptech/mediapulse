import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentById } from "@/lib/agents";

import { AgentDetailsContent } from "./agent-details-content";

/**
 * Agent detail page. Loads agent by id; shows 404 if not found, otherwise tabbed details (General, Input schema, Config schema).
 */
const AgentDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const agent = await getAgentById(id);

  if (!agent) {
    notFound();
  }

  return <AgentDetailsContent agent={agent} />;
};

export default withAuthProtection(AgentDetailPage);
