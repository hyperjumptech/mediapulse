import type { DashboardPage } from "@hermes/domain-contract";
import type {
  ContentGenerationRunListItem,
  ContentGenerationRunOutcome,
  InsightsPayload,
} from "@workspace/agent-data-api-contract";
import type { ComponentType, ReactNode } from "react";

/** Opaque runtime config owned by the registered dashboard extension package. */
export type HermesDashboardExtensionRuntimeConfig = Record<string, unknown>;

export type ContentGenerationRunsListQuery = {
  cursor?: string;
  limit: number;
  outcome?: ContentGenerationRunOutcome;
  tickerId?: string;
  startTime?: string;
  endTime?: string;
};

export type ContentGenerationRunsListResult = {
  items: ContentGenerationRunListItem[];
  nextCursor?: string;
};

export type GetAgentInsightsParams = {
  agentId: string;
  window: "24h" | "7d" | "30d";
};

export type GetAgentInsightsResult =
  | { payload: InsightsPayload; hasInsights: true }
  | { payload: null; hasInsights: false };

/**
 * Optional operator UI and APIs registered by a product domain (loaded via env).
 */
export type HermesDashboardExtensions = {
  /** Builds synthetic nav pages when `operator-diagnostics` capability is enabled. */
  buildOperatorDiagnosticsNavPages: () => DashboardPage[];
  /** Returns extension-owned runtime config (env, credentials, feature flags). */
  getRuntimeConfig: () => HermesDashboardExtensionRuntimeConfig;
  ContentGenerationRunsPageView: ComponentType<{
    integrationId: string;
    config: HermesDashboardExtensionRuntimeConfig;
    searchParams: Promise<Record<string, string | undefined>>;
  }>;
  ContentGenerationRunDetailPageView: ComponentType<{
    runId: string;
    config: HermesDashboardExtensionRuntimeConfig;
  }>;
  SectionCoveragePageView: ComponentType<{
    config: HermesDashboardExtensionRuntimeConfig;
    searchParams: Promise<Record<string, string | undefined>>;
  }>;
  listContentGenerationRuns: (
    query: ContentGenerationRunsListQuery,
    config: HermesDashboardExtensionRuntimeConfig,
  ) => Promise<ContentGenerationRunsListResult>;
  getContentGenerationRunById: (
    id: string,
    config: HermesDashboardExtensionRuntimeConfig,
  ) => Promise<ContentGenerationRunListItem | null>;
  getAgentInsights: (
    params: GetAgentInsightsParams,
    config: HermesDashboardExtensionRuntimeConfig,
  ) => Promise<GetAgentInsightsResult>;
  InsightsTab: ComponentType<{
    payload: InsightsPayload;
    window: "24h" | "7d" | "30d";
  }>;
  renderInsightsPanel: (props: {
    payload: InsightsPayload;
    window: "24h" | "7d" | "30d";
  }) => ReactNode;
};
