import type { DashboardViewInput } from "@hermes/domain-contract";
import { env } from "@mediapulse/env";

import { hermesDashboardManifestApiPrefix } from "./hermes-dashboard-path-helpers";

const contentApiPrefix = (segment: string): string =>
  `${hermesDashboardManifestApiPrefix("content")}/${segment}`;

/**
 * Operator dashboard views served by domain-api HTTP (not embedded in Hermes).
 *
 * @returns Manifest views merged into registration when CGA diagnostics are enabled.
 */
export const buildMediapulseOperatorContentViews = (): DashboardViewInput[] => {
  if (env.MEDIAPULSE_CGA_DIAGNOSTICS_ENABLED !== "true") {
    return [];
  }

  return [
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
    {
      id: "operator-agent-insights",
      label: "Insights",
      tabLabel: "Insights",
      kind: "html",
      placement: "agent-tab",
      apiPrefix: contentApiPrefix("agent-insights"),
      order: 10,
      agentIds: ["content-generation"],
    },
  ];
};
