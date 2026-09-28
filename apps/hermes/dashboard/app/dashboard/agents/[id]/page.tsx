import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getAgentById } from "@/lib/agents";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

import { AgentDetailsContent } from "./agent-details-content";
import { AgentTabContentsSection } from "./agent-tab-contents-section";

const AgentDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const agent = await withDashboardAdmin(getAgentById(id));

  if (!agent) {
    notFound();
  }

  return (
    <Suspense fallback={<AgentDetailsContent agent={agent} />}>
      <AgentTabContentsSection agent={agent} />
    </Suspense>
  );
};

export default AgentDetailPage;
