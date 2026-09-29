import type {
  InvocationPayloadSource,
  ScheduleExecutionInvocationRow,
} from "@/components/use-schedule-execution-invocations-modal";
import type { CancelTarget } from "@/hooks/use-hermes-execution-cancel-button";
import {
  computePipelineWallElapsed,
  formatPipelineElapsedLabel,
} from "@/lib/compute-execution-elapsed";
import { isHermesExecutionCancellable } from "@/lib/hermes-execution-cancellable";
import { formatManualExecutionMetadataHints } from "@/lib/manual-execution-metadata-hints";
import type {
  ExecutionSummary,
  InvocationSummary,
  StepExecutionSummary,
} from "@/lib/execution-summary";
import { maskSecretsInJson } from "@/lib/json-secret-mask";
import { maskExecutionSummaryForDisplay } from "@/lib/mask-json-secrets";

export type ExecutionDetailKind = InvocationPayloadSource["kind"];

export type ExecutionDetailPipeline = {
  id: string;
  name: string;
};

export type ExecutionDetailParent = {
  kind: ExecutionDetailKind;
  id: string;
  name: string;
};

export type ExecutionDetailSummary = {
  execution: ExecutionSummary;
  pipeline: ExecutionDetailPipeline | null;
  stepExecutions: StepExecutionSummary[];
  invocations: InvocationSummary[];
};

export type ExecutionDetailViewModel = {
  executionId: string;
  parent: ExecutionDetailParent;
  sourceLabel: string | null;
  pipeline: ExecutionDetailPipeline | null;
  runStatus: string;
  enqueueStatus: string;
  executionTimeIso: string;
  elapsedLabel: string;
  succeededInvocationCount: number;
  failedInvocationCount: number;
  expectedInvocationCount: number;
  metadataHints: string[];
  requestSnapshotJson: string | null;
  runParamsJson: string | null;
  enqueueErrors: unknown;
  enqueueMetadata: unknown;
  steps: StepExecutionSummary[];
  invocations: ScheduleExecutionInvocationRow[];
  canCancel: boolean;
  cancelTarget: CancelTarget;
  payloadSource: InvocationPayloadSource;
  processedUrlsHref: string | null;
};

export type BuildExecutionDetailViewModelInput = {
  parent: ExecutionDetailParent;
  executionId: string;
  summary: ExecutionDetailSummary;
};

const MANUAL_RUN_SOURCE_LABEL = "Manual run";

const buildCancelTarget = (
  parent: ExecutionDetailParent,
  executionId: string,
): CancelTarget => {
  if (parent.kind === "schedule") {
    return {
      kind: "schedule",
      scheduleId: parent.id,
      scheduleExecutionId: executionId,
    };
  }

  if (parent.kind === "httpTrigger") {
    return {
      kind: "httpTrigger",
      httpTriggerId: parent.id,
      httpTriggerExecutionId: executionId,
    };
  }

  return {
    kind: "manual",
    pipelineId: parent.id,
    manualExecutionId: executionId,
  };
};

const buildSourceLabel = (parent: ExecutionDetailParent): string | null =>
  parent.kind === "manual" ? MANUAL_RUN_SOURCE_LABEL : null;

const pipelineOtherThanParent = (
  parent: ExecutionDetailParent,
  pipeline: ExecutionDetailPipeline | null,
): ExecutionDetailPipeline | null =>
  parent.kind === "manual" && pipeline?.id === parent.id ? null : pipeline;

const sumExpectedInvocations = (steps: StepExecutionSummary[]): number =>
  steps.reduce((total, step) => total + step.expectedInvocationCount, 0);

const buildProcessedUrlsHref = (
  parent: ExecutionDetailParent,
  executionId: string,
): string | null => {
  if (parent.kind !== "schedule") {
    return null;
  }

  return `/dashboard/schedules/${parent.id}/executions/${executionId}/processed-urls`;
};

const buildMetadataHints = (
  parent: ExecutionDetailParent,
  metadata: unknown,
): string[] => {
  if (parent.kind !== "manual") {
    return [];
  }

  return formatManualExecutionMetadataHints(metadata);
};

const buildRequestSnapshotJson = (
  parent: ExecutionDetailParent,
  metadata: unknown,
): string | null => {
  if (parent.kind !== "httpTrigger" || metadata == null) {
    return null;
  }

  return JSON.stringify(metadata, null, 2);
};

const buildRunParamsJson = (runParams: unknown): string | null => {
  const hasRunParams =
    runParams != null &&
    typeof runParams === "object" &&
    Object.keys(runParams).length > 0;
  if (!hasRunParams) {
    return null;
  }

  return JSON.stringify(maskSecretsInJson(runParams), null, 2);
};

const toInvocationRow = (
  invocation: InvocationSummary,
): ScheduleExecutionInvocationRow => ({
  jobId: invocation.jobId,
  status: invocation.status,
  semanticStatus: invocation.semanticStatus,
  outcomeSummary: invocation.outcomeSummary,
  agentId: invocation.agentId,
  startedAtIso: invocation.startedAt?.toISOString() ?? null,
  completedAtIso: invocation.completedAt?.toISOString() ?? null,
  dataQueueAttempts: invocation.dataQueueAttempts,
  dataQueueMaxAttempts: invocation.dataQueueMaxAttempts,
});

export const buildExecutionDetailViewModel = ({
  parent,
  executionId,
  summary,
}: BuildExecutionDetailViewModelInput): ExecutionDetailViewModel => {
  const pipelineElapsed = computePipelineWallElapsed(
    summary.invocations,
    summary.execution.runStatus,
  );
  const maskedSummary = maskExecutionSummaryForDisplay(summary);
  const { execution } = maskedSummary;

  return {
    executionId,
    parent,
    sourceLabel: buildSourceLabel(parent),
    pipeline: pipelineOtherThanParent(parent, maskedSummary.pipeline),
    runStatus: execution.runStatus,
    enqueueStatus: execution.enqueueStatus,
    executionTimeIso: execution.executionTime.toISOString(),
    elapsedLabel: formatPipelineElapsedLabel(pipelineElapsed),
    succeededInvocationCount: execution.succeededInvocationCount,
    failedInvocationCount: execution.failedInvocationCount,
    expectedInvocationCount: sumExpectedInvocations(
      maskedSummary.stepExecutions,
    ),
    metadataHints: buildMetadataHints(parent, execution.metadata),
    requestSnapshotJson: buildRequestSnapshotJson(parent, execution.metadata),
    runParamsJson: buildRunParamsJson(execution.runParams),
    enqueueErrors: execution.errors,
    enqueueMetadata: execution.metadata,
    steps: maskedSummary.stepExecutions,
    invocations: maskedSummary.invocations.map(toInvocationRow),
    canCancel: isHermesExecutionCancellable(execution.runStatus),
    cancelTarget: buildCancelTarget(parent, executionId),
    payloadSource: { kind: parent.kind, parentId: parent.id, executionId },
    processedUrlsHref: buildProcessedUrlsHref(parent, executionId),
  };
};
