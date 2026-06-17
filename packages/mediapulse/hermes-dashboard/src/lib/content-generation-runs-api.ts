import type {
  ContentGenerationRunListItem,
  ContentGenerationRunOutcome,
} from "@workspace/agent-data-api-contract";

import type { MediapulseHermesDashboardRuntimeConfig } from "../config";
import { createMediapulseAgentDataApiClient } from "./agent-data-api-client";

type ContentGenerationRunsClient = Pick<
  ReturnType<typeof createMediapulseAgentDataApiClient>,
  "contentGenerationRuns"
>;

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

/**
 * Fetches a page of content-generation runs from agent-data-api.
 *
 * @param query - Cursor, limit, and optional filters.
 * @param config - Runtime config with agent-data-api URL and internal API key.
 * @param client - Injectable SDK client for tests.
 * @returns Run rows and optional next cursor.
 */
export const listContentGenerationRuns = async (
  query: ContentGenerationRunsListQuery,
  config: MediapulseHermesDashboardRuntimeConfig,
  client?: ContentGenerationRunsClient,
): Promise<ContentGenerationRunsListResult> => {
  const resolved = client ?? createMediapulseAgentDataApiClient(config);
  const result = await resolved.contentGenerationRuns.get({
    cursor: query.cursor,
    limit: query.limit,
    outcome: query.outcome,
    tickerId: query.tickerId,
    startTime: query.startTime,
    endTime: query.endTime,
  });
  return { items: result.data, nextCursor: result.nextCursor };
};

/**
 * Loads a single content-generation run by id (list-with-cursor workaround).
 *
 * @param id - Run UUID.
 * @param config - Runtime config with agent-data-api URL and internal API key.
 * @param client - Injectable SDK client for tests.
 * @returns The run row or null when not found.
 */
export const getContentGenerationRunById = async (
  id: string,
  config: MediapulseHermesDashboardRuntimeConfig,
  client?: ContentGenerationRunsClient,
): Promise<ContentGenerationRunListItem | null> => {
  const resolved = client ?? createMediapulseAgentDataApiClient(config);
  const result = await resolved.contentGenerationRuns.get({
    cursor: id,
    limit: 1,
  });
  return result.data.find((run) => run.id === id) ?? null;
};
