import { env as hermesEnv } from "@hermes/env";
import type { HermesDashboardExtensions } from "@hermes/dashboard-extensions";
import { env as mediapulseEnv } from "@mediapulse/env";
import { createElement } from "react";

import { InsightsTab } from "./insights/insights-tab";
import { ContentGenerationRunDetailPageView } from "./content-generation-runs/content-generation-run-detail-page";
import { ContentGenerationRunsPageView } from "./content-generation-runs/content-generation-runs-page";
import type { MediapulseHermesDashboardRuntimeConfig } from "./config";
import { buildOperatorDiagnosticsNavPages } from "./diagnostics-nav";
import {
  getContentGenerationRunById,
  listContentGenerationRuns,
} from "./lib/content-generation-runs-api";
import { getAgentInsights } from "./lib/agent-insights-api";
import { SectionCoveragePageView } from "./section-coverage/section-coverage-page";

/**
 * Builds Mediapulse operator dashboard runtime config for Hermes-hosted routes.
 */
const getRuntimeConfig = (): MediapulseHermesDashboardRuntimeConfig => ({
  agentDataApiUrl: mediapulseEnv.AGENT_DATA_API_URL ?? "",
  agentAuthApiUrl: mediapulseEnv.AGENT_AUTH_API_URL,
  internalApiKey: hermesEnv.HERMES_INTERNAL_API_KEY,
  cgaDiagnosticsEnabled:
    mediapulseEnv.MEDIAPULSE_CGA_DIAGNOSTICS_ENABLED === "true",
});

/**
 * Mediapulse implementation of optional Hermes dashboard extensions.
 */
export const hermesDashboardExtensions = {
  buildOperatorDiagnosticsNavPages,
  getRuntimeConfig,
  ContentGenerationRunsPageView,
  ContentGenerationRunDetailPageView,
  SectionCoveragePageView,
  listContentGenerationRuns,
  getContentGenerationRunById,
  getAgentInsights,
  InsightsTab,
  renderInsightsPanel: ({ payload, window }) =>
    createElement(InsightsTab, { payload, window }),
} satisfies HermesDashboardExtensions;
