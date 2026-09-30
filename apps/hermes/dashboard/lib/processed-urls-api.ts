import {
  fetchProcessedUrlsForExecution,
  type FetchProcessedUrlsParams,
  type ProcessedUrlsListResponse,
} from "@/lib/domain-dashboard";
import {
  loadProcessedUrlsExecution,
  type ProcessedUrlsExecution,
} from "@/lib/processed-urls-execution";

export type ProcessedUrlsApiQuery = Omit<
  FetchProcessedUrlsParams,
  "integrationId" | "scheduleExecutionId"
> & {
  scheduleId: string;
  executionId: string;
};

export type ProcessedUrlsApiDependencies = {
  loadExecution: (
    scheduleId: string,
    executionId: string,
  ) => Promise<ProcessedUrlsExecution | null>;
  fetchProcessedUrls: (
    params: FetchProcessedUrlsParams,
  ) => Promise<ProcessedUrlsListResponse>;
};

const defaultDependencies: ProcessedUrlsApiDependencies = {
  loadExecution: (scheduleId, executionId) =>
    loadProcessedUrlsExecution(scheduleId, executionId),
  fetchProcessedUrls: (params) => fetchProcessedUrlsForExecution(params),
};

export const getProcessedUrlsForApi = async (
  { scheduleId, executionId, ...filters }: ProcessedUrlsApiQuery,
  dependencies: ProcessedUrlsApiDependencies = defaultDependencies,
): Promise<ProcessedUrlsListResponse | null> => {
  const execution = await dependencies.loadExecution(scheduleId, executionId);
  if (!execution) {
    return null;
  }

  return dependencies.fetchProcessedUrls({
    ...filters,
    integrationId: execution.integrationId,
    scheduleExecutionId: executionId,
  });
};
