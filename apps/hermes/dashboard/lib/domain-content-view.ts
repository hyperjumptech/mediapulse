import {
  contentViewResponseSchema,
  type ContentViewResponse,
  type DashboardView,
} from "@hermes/domain-contract";

import { getBearerJwtForDomainIntegrationId } from "@/lib/domain-integration-auth-token";
import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";

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

/**
 * Fetches rendered content for a markdown, html, or text dashboard view.
 *
 * @param input - Integration id, view definition, and optional agent id for agent-tab views.
 * @returns Parsed content payload from the domain API.
 */
export const fetchDomainContentView = async (input: {
  integrationId: string;
  view: Extract<DashboardView, { kind: "markdown" | "html" | "text" }>;
  agentId?: string;
}): Promise<ContentViewResponse> => {
  const integration = await getDomainIntegrationByIntegrationId(
    input.integrationId,
  );
  if (!integration) {
    throw new Error(
      `Domain integration "${input.integrationId}" is not active or not registered`,
    );
  }

  const baseUrl = integration.baseUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}${input.view.apiPrefix}`);
  if (input.agentId) {
    url.searchParams.set("agentId", input.agentId);
  }

  const token = await getBearerJwtForDomainIntegrationId(integration.id);
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Domain content view failed (${response.status}): ${await response.text()}`,
    );
  }

  const json: unknown = await response.json();
  return contentViewResponseSchema.parse(json);
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
): Promise<
  Array<{
    view: DashboardView;
    content: ContentViewResponse;
  }>
> => {
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) {
    return [];
  }

  const tabViews = filterAgentTabViewsForAgent(
    integration.dashboard.views,
    agentId,
  ).filter(
    (
      view,
    ): view is Extract<DashboardView, { kind: "markdown" | "html" | "text" }> =>
      view.kind === "markdown" || view.kind === "html" || view.kind === "text",
  );

  const results = await Promise.all(
    tabViews.map(async (view) => ({
      view,
      content: await fetchDomainContentView({
        integrationId,
        view,
        agentId,
      }),
    })),
  );

  return results;
};
