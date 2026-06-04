import type { SectionCoverageVersionRow } from "@workspace/agent-data-api-contract";

import { getDashboardAgentDataApiClient } from "./agent-data-api-client";

export type { SectionCoverageVersionRow };

/**
 * Fetches the section-coverage rollup for a single ticker over a rolling window.
 *
 * @param tickerId - The ticker to query.
 * @param windowDays - Rolling window in calendar days (default 30).
 * @returns Array of per-version rows sorted by contract version (nulls last).
 */
export const getSectionCoverageRollupForTicker = async (
  tickerId: string,
  windowDays = 30,
): Promise<SectionCoverageVersionRow[]> => {
  const client = getDashboardAgentDataApiClient();
  const response = await client.sectionCoverageRollup.get({
    tickerId,
    windowDays,
  });

  return response.byVersion;
};
