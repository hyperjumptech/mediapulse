import {
  contentViewResponseSchema,
  type ContentViewResponse,
  type DashboardView,
} from "@hermes/domain-contract";

import { requestDomainIntegration } from "@/lib/domain-integration-request";
import {
  getDomainIntegrationByIntegrationId,
  type DomainIntegrationRecord,
} from "@/lib/domain-integrations";

type ContentDashboardView = Extract<
  DashboardView,
  { kind: "markdown" | "html" | "text" }
>;

type AgentTabContent = {
  view: DashboardView;
  content: ContentViewResponse;
};

/**
 * Returns agent-tab views from an integration manifest that apply to the given agent id.
 *
 * @param views - Manifest views for the integration.
 * @param agentId - Registry agent id (e.g. `content-generation`).
 * @returns Matching agent-tab views sorted by `order`.
 */
export const filterAgentTabViewsForAgent = (
  views: DashboardView[],
  agentId: string,
): DashboardView[] =>
  views
    .filter((view) => view.placement === "agent-tab")
    .filter(
      (view) =>
        view.agentIds == null ||
        view.agentIds.length === 0 ||
        view.agentIds.includes(agentId),
    )
    .sort((a, b) => a.order - b.order);

const fetchContentViewForIntegration = async (
  integration: DomainIntegrationRecord,
  view: ContentDashboardView,
  agentId: string | undefined,
): Promise<ContentViewResponse> => {
  const baseUrl = integration.baseUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}${view.apiPrefix}`);
  if (agentId) {
    url.searchParams.set("agentId", agentId);
  }

  return requestDomainIntegration(
    {
      url: url.toString(),
      domainIntegrationId: integration.id,
      integrationLabel: integration.integrationId,
      init: { headers: { Accept: "application/json" } },
    },
    async (response) => {
      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `Domain content view failed (${response.status}): ${responseText}`,
        );
      }

      const json: unknown = await response.json();

      return contentViewResponseSchema.parse(json);
    },
  );
};

/**
 * Fetches rendered content for a markdown, html, or text dashboard view.
 *
 * @param input - Integration id, view definition, and optional agent id for agent-tab views.
 * @returns Parsed content payload from the domain API.
 */
export const fetchDomainContentView = async (input: {
  integrationId: string;
  view: ContentDashboardView;
  agentId?: string;
  integration?: DomainIntegrationRecord;
}): Promise<ContentViewResponse> => {
  const integration =
    input.integration ??
    (await getDomainIntegrationByIntegrationId(input.integrationId));
  if (!integration) {
    throw new Error(
      `Domain integration "${input.integrationId}" is not active or not registered`,
    );
  }

  return fetchContentViewForIntegration(integration, input.view, input.agentId);
};

const loadAgentTabContent = async (
  integration: DomainIntegrationRecord,
  view: ContentDashboardView,
  agentId: string,
): Promise<AgentTabContent> => {
  try {
    const content = await fetchContentViewForIntegration(
      integration,
      view,
      agentId,
    );

    return { view, content };
  } catch (error) {
    console.error(
      `Could not load agent tab "${view.id}" from domain integration "${integration.integrationId}"`,
      error,
    );
    throw error;
  }
};

/**
 * Loads all agent-tab content payloads for an agent in parallel.
 *
 * @param integrationId - Domain integration slug.
 * @param agentId - Agent registry id.
 * @returns Tab id, label, kind, and fetched content per view.
 */
export const fetchAgentTabContents = async (
  integrationId: string,
  agentId: string,
): Promise<AgentTabContent[]> => {
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) {
    return [];
  }

  const tabViews = filterAgentTabViewsForAgent(
    integration.dashboard.views,
    agentId,
  ).filter(
    (view): view is ContentDashboardView =>
      view.kind === "markdown" || view.kind === "html" || view.kind === "text",
  );

  const settledTabs = await Promise.allSettled(
    tabViews.map((view) => loadAgentTabContent(integration, view, agentId)),
  );
  const loadedTabs = settledTabs.flatMap((settledTab) =>
    settledTab.status === "fulfilled" ? [settledTab.value] : [],
  );
  const firstFailedTab = settledTabs.find(
    (settledTab): settledTab is PromiseRejectedResult =>
      settledTab.status === "rejected",
  );
  if (loadedTabs.length === 0 && firstFailedTab) {
    throw firstFailedTab.reason;
  }

  return loadedTabs;
};
