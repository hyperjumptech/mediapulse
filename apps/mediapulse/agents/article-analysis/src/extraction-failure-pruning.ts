import { createAgentDataApiClient } from "@workspace/agent-data-api-client";

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
