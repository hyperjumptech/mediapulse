import type { SectionCoverageVersionRow } from "@workspace/agent-data-api-contract";

import type { MediapulseHermesDashboardRuntimeConfig } from "../config";
import { createMediapulseAgentDataApiClient } from "./agent-data-api-client";

export type { SectionCoverageVersionRow };

/**
 * Fetches the section-coverage rollup for a single ticker over a rolling window.
 *
 * @param tickerId - The ticker to query.
 * @param config - Runtime config with agent-data-api URL and internal API key.
 * @param windowDays - Rolling window in calendar days (default 30).
 * @returns Array of per-version rows sorted by contract version (nulls last).
 */
export const getSectionCoverageRollupForTicker = async (
  tickerId: string,
  config: MediapulseHermesDashboardRuntimeConfig,
  windowDays = 30,
): Promise<SectionCoverageVersionRow[]> => {
  const client = createMediapulseAgentDataApiClient(config);
  const response = await client.sectionCoverageRollup.get({
    tickerId,
    windowDays,
  });

  return response.byVersion;
};
