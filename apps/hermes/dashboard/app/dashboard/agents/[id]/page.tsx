import { notFound } from "next/navigation";

import { withAuthProtection } from "@/components/with-auth-protection";
import { getAgentById } from "@/lib/agents";
import { getAgentInsights } from "@mediapulse/hermes-dashboard";
import { getMediapulseHermesDashboardRuntimeConfig } from "@/lib/mediapulse-hermes-dashboard-config";

import { AgentDetailsContent } from "./agent-details-content";

/**
 * Agent detail page. Loads agent by id (with domain integration id); shows 404 if not found, otherwise tabbed details (General, Input schema, Config schema, and Insights).
 */
const AgentDetailPage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const agent = await getAgentById(id);

  if (!agent) {
    notFound();
  }

  const rawWindow = resolvedSearchParams["insightsWindow"];
  const windowParam = Array.isArray(rawWindow) ? rawWindow[0] : rawWindow;
  const insightsWindow: "24h" | "7d" | "30d" =
    windowParam === "24h" || windowParam === "7d" || windowParam === "30d"
      ? windowParam
      : "7d";

  const result = await getAgentInsights(
    {
      agentId: agent.agentId,
      window: insightsWindow,
    },
    getMediapulseHermesDashboardRuntimeConfig(),
  );
  const insightsPayload = result.hasInsights ? result.payload : null;

  return (
    <AgentDetailsContent
      agent={agent}
      insightsPayload={insightsPayload}
      insightsWindow={insightsWindow}
    />
  );
};

export default withAuthProtection(AgentDetailPage);
