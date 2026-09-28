export type ExecutionListSource = "manual" | "schedule" | "http-trigger";

export type ExecutionListRow = {
  id: string;
  source: ExecutionListSource;
  sourceId: string;
  sourceName: string | null;
  pipelineName: string | null;
  executionTime: Date;
  runStatus: string;
  enqueueStatus: string | null;
  succeededInvocationCount: number | null;
  failedInvocationCount: number | null;
  elapsedLabel: string | null;
};

const SOURCE_PATHS: Record<Exclude<ExecutionListSource, "manual">, string> = {
  schedule: "/dashboard/schedules",
  "http-trigger": "/dashboard/http-triggers",
};

export const executionDetailHref = (
  row: Pick<ExecutionListRow, "id" | "source" | "sourceId">,
): string => {
  if (row.source === "manual") {
    return `/dashboard/pipelines/${row.sourceId}/executions/${row.id}`;
  }

  return `${SOURCE_PATHS[row.source]}/${row.sourceId}/executions/${row.id}`;
};

export const executionSourceHref = (
  row: Pick<ExecutionListRow, "source" | "sourceId">,
): string | null =>
  row.source === "manual"
    ? null
    : `${SOURCE_PATHS[row.source]}/${row.sourceId}`;

export type ExecutionCancelTarget =
  | { kind: "schedule"; scheduleId: string; scheduleExecutionId: string }
  | {
      kind: "httpTrigger";
      httpTriggerId: string;
      httpTriggerExecutionId: string;
    }
  | { kind: "manual"; pipelineId: string; manualExecutionId: string };

export const executionCancelTarget = (
  row: Pick<ExecutionListRow, "id" | "source" | "sourceId">,
): ExecutionCancelTarget => {
  if (row.source === "schedule") {
    return {
      kind: "schedule",
      scheduleId: row.sourceId,
      scheduleExecutionId: row.id,
    };
  }
  if (row.source === "http-trigger") {
    return {
      kind: "httpTrigger",
      httpTriggerId: row.sourceId,
      httpTriggerExecutionId: row.id,
    };
  }

  return {
    kind: "manual",
    pipelineId: row.sourceId,
    manualExecutionId: row.id,
  };
};

type PipelineExecutionLike = {
  id: string;
  source: ExecutionListSource;
  sourceId: string;
  sourceName: string | null;
  executionTime: Date;
  runStatus: string;
  enqueueStatus: string;
  succeededInvocationCount: number;
  failedInvocationCount: number;
  elapsedLabel: string;
};

export const pipelineExecutionToListRow = (
  execution: PipelineExecutionLike,
  pipelineName: string | null = null,
): ExecutionListRow => ({
  id: execution.id,
  source: execution.source,
  sourceId: execution.sourceId,
  sourceName: execution.sourceName,
  pipelineName,
  executionTime: execution.executionTime,
  runStatus: execution.runStatus,
  enqueueStatus: execution.enqueueStatus,
  succeededInvocationCount: execution.succeededInvocationCount,
  failedInvocationCount: execution.failedInvocationCount,
  elapsedLabel: execution.elapsedLabel,
});
