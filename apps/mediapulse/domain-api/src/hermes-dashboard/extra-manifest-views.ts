import type { DashboardViewInput } from "@hermes/domain-contract";
import { env } from "@mediapulse/env";

import { hermesDashboardManifestApiPrefix } from "./hermes-dashboard-path-helpers";

const contentApiPrefix = (segment: string): string =>
  `${hermesDashboardManifestApiPrefix("content")}/${segment}`;

/** Registry agent ids that have an insights provider in agent-data-api. */
const AGENT_INSIGHTS_AGENT_IDS = [
  "article-analysis",
  "content-generation",
  "data-collection",
  "delivery",
  "newsletter-feedback",
  "page-collection",
  "query-analysis",
  "user-registration",
] as const;

/**
 * Operator dashboard views served by domain-api HTTP (not embedded in Hermes).
 *
 * The agent Insights tab is always present for agents with an insights provider.
 * The section-coverage and CGA diagnostics sidebar views are gated behind the
 * `MEDIAPULSE_CGA_DIAGNOSTICS_ENABLED` flag.
 *
 * @returns Manifest views merged into registration.
 */
export const buildMediapulseOperatorContentViews = (): DashboardViewInput[] => {
  const views: DashboardViewInput[] = [
    {
      id: "operator-agent-insights",
      label: "Insights",
      tabLabel: "Insights",
      kind: "html",
      placement: "agent-tab",
      apiPrefix: contentApiPrefix("agent-insights"),
      order: 10,
      agentIds: [...AGENT_INSIGHTS_AGENT_IDS],
    },
  ];

  if (env.MEDIAPULSE_CGA_DIAGNOSTICS_ENABLED === "true") {
    views.push(
      {
        id: "operator-section-coverage",
        label: "Section coverage",
        kind: "html",
        placement: "sidebar",
        pathSegment: "section-coverage",
        apiPrefix: contentApiPrefix("section-coverage"),
        order: 910,
      },
      {
        id: "operator-cga-diagnostics",
        label: "CGA diagnostics",
        kind: "html",
        placement: "sidebar",
        pathSegment: "content-generation-runs",
        apiPrefix: contentApiPrefix("content-generation-runs"),
        order: 920,
      },
    );
  }

  return views;
};
