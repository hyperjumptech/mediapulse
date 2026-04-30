import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { NonArticleReason } from "./non-article-source-filter.js";

/**
 * Minimal API client contract used to prune one data source row.
 */
type DataSourcePruneClient = Pick<
  ReturnType<typeof createAgentDataApiClient>,
  "analysisDataSourceDelete"
>;

type PruneDeps = {
  /** Typed agent-data-api client used to call `analysisDataSourceDelete.create`. */
  dataApiClient: DataSourcePruneClient;
  /** Ticker id used to scope the delete request. */
  tickerId: string;
};

/**
 * Returns whether an extraction error should trigger hard deletion of the source.
 *
 * @param message - Error message captured from extraction failure.
 * @returns True when the message matches known unrecoverable parse failures.
 */
export const shouldHardDeleteDataSourceForExtractionError = (
  message: string,
): boolean =>
  message.includes("No object generated: could not parse the response.");

/**
 * Returns whether a non-article prefilter reason is safe for hard deletion.
 *
 * @param reason - Deterministic non-article classification reason.
 * @returns True when the reason is strong enough to prune permanently.
 */
export const shouldHardDeleteDataSourceForNonArticleReason = (
  reason: NonArticleReason,
): boolean =>
  reason === "prefilter_blocked_host" || reason === "prefilter_blocked_path";

/**
 * Hard-deletes a data source row through agent-data-api.
 *
 * @param dataSourceId - Data source id to delete.
 * @param deps - API dependencies.
 * @returns Promise that resolves when deletion is complete.
 */
export const hardDeleteDataSourceById = async (
  dataSourceId: string,
  deps: PruneDeps,
): Promise<void> => {
  await deps.dataApiClient.analysisDataSourceDelete.create({
    tickerId: deps.tickerId,
    dataSourceId,
  });
};
