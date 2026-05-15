import type {
  ContentGenerationRunListItem,
  ContentGenerationRunOutcome,
} from "@workspace/agent-data-api-contract";

import {
  createDashboardAgentDataApiClient,
  getDashboardAgentDataApiClient,
} from "@/lib/agent-data-api-client";

type ContentGenerationRunsClient = Pick<
  ReturnType<typeof createDashboardAgentDataApiClient>,
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
 * @param client - Injectable SDK client for tests.
 * @returns Run rows and optional next cursor.
 */
export const listContentGenerationRuns = async (
  query: ContentGenerationRunsListQuery,
  client: ContentGenerationRunsClient = getDashboardAgentDataApiClient(),
): Promise<ContentGenerationRunsListResult> => {
  const result = await client.contentGenerationRuns.get({
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
 * @param client - Injectable SDK client for tests.
 * @returns The run row or null when not found.
 */
export const getContentGenerationRunById = async (
  id: string,
  client: ContentGenerationRunsClient = getDashboardAgentDataApiClient(),
): Promise<ContentGenerationRunListItem | null> => {
  const result = await client.contentGenerationRuns.get({
    cursor: id,
    limit: 1,
  });
  return result.data.find((run) => run.id === id) ?? null;
};
