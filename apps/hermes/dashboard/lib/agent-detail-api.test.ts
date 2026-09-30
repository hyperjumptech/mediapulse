/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  getAgentDetailForApi,
  type AgentDetailApiDependencies,
} from "@/lib/agent-detail-api";

const agentRegistryId = "00000000-0000-4000-8000-000000000001";

const agent = {
  id: agentRegistryId,
  agentId: "writer",
  agentVersion: "1.0.0",
  domainIntegration: { integrationId: "acme", name: "Acme" },
} as unknown as NonNullable<
  Awaited<ReturnType<AgentDetailApiDependencies["getAgent"]>>
>;

const view = (overrides: Record<string, unknown>) => ({
  id: "insights",
  label: "Insights",
  order: 1,
  placement: "agent-tab",
  apiPrefix: "/v1/insights",
  kind: "markdown",
  ...overrides,
});

describe("getAgentDetailForApi", () => {
  it("lists the integration's agent tabs that apply to the agent", async () => {
    const dependencies: AgentDetailApiDependencies = {
      getAgent: vi.fn().mockResolvedValue(agent),
      getIntegration: vi.fn().mockResolvedValue({
        integrationId: "acme",
        dashboard: {
          views: [
            view({ id: "insights", tabLabel: "Run insights" }),
            view({ id: "other-agent", agentIds: ["collector"] }),
            view({ id: "sidebar", placement: "sidebar" }),
          ],
        },
      }),
    };

    const detail = await getAgentDetailForApi(agentRegistryId, dependencies);

    expect(dependencies.getIntegration).toHaveBeenCalledWith("acme");
    expect(detail?.agentTabViews).toEqual([
      {
        integrationId: "acme",
        viewId: "insights",
        label: "Run insights",
        kind: "markdown",
      },
    ]);
  });

  it("returns no tabs when the integration is not active", async () => {
    const dependencies: AgentDetailApiDependencies = {
      getAgent: vi.fn().mockResolvedValue(agent),
      getIntegration: vi.fn().mockResolvedValue(null),
    };

    const detail = await getAgentDetailForApi(agentRegistryId, dependencies);

    expect(detail?.agentTabViews).toEqual([]);
  });

  it("returns null when the agent does not exist", async () => {
    const dependencies: AgentDetailApiDependencies = {
      getAgent: vi.fn().mockResolvedValue(null),
      getIntegration: vi.fn(),
    };

    const detail = await getAgentDetailForApi(agentRegistryId, dependencies);

    expect(detail).toBeNull();
    expect(dependencies.getIntegration).not.toHaveBeenCalled();
  });
});
