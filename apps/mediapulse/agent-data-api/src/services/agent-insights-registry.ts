import type { InsightsPayload } from "@workspace/agent-data-api-contract";

export type InsightsContext = {
  window: "24h" | "7d" | "30d";
  tickerId?: string;
};

export interface AgentInsightsProvider {
  agentId: string;
  compute(context: InsightsContext): Promise<InsightsPayload>;
}

const registry = new Map<string, AgentInsightsProvider>();

export const registerInsightsProvider = (
  provider: AgentInsightsProvider,
): void => {
  registry.set(provider.agentId, provider);
};

export const resolveInsightsProvider = (
  agentId: string,
): AgentInsightsProvider | undefined => registry.get(agentId);
