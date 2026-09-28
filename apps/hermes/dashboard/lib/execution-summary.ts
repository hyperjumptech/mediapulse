import type { Prisma } from "@hermes/orchestration-database";

import { formatInvocationOutcomeSummary } from "./format-invocation-outcome-summary";

export const executionSummarySelect = {
  id: true,
  executionTime: true,
  enqueueStatus: true,
  runStatus: true,
  effectiveExecutionConfig: true,
  jobsCreated: true,
  jobsEnqueued: true,
  succeededInvocationCount: true,
  failedInvocationCount: true,
  errors: true,
  metadata: true,
  createdAt: true,
} as const;

export const stepExecutionSummarySelect = {
  pipelineStepId: true,
  expectedInvocationCount: true,
  succeededCount: true,
  failedCount: true,
  rollupStatus: true,
  pipelineStep: {
    select: { order: true, agentId: true, agentVersion: true },
  },
} as const;

export const invocationSummarySelect = {
  jobId: true,
  status: true,
  semanticStatus: true,
  agentId: true,
  error: true,
  agentResponse: true,
  enqueuedAt: true,
  startedAt: true,
  completedAt: true,
  dataQueueAttempts: true,
  dataQueueMaxAttempts: true,
} satisfies Prisma.AgentJobExecutionSelect;

export type ExecutionSummary = {
  id: string;
  executionTime: Date;
  enqueueStatus: string;
  runStatus: string;
  effectiveExecutionConfig: unknown;
  jobsCreated: number;
  jobsEnqueued: number;
  succeededInvocationCount: number;
  failedInvocationCount: number;
  errors: unknown;
  metadata: unknown | null;
  createdAt: Date;
};

export type StepExecutionSummary = {
  pipelineStepId: string;
  stepOrder: number;
  agentId: string;
  agentVersion: string;
  expectedInvocationCount: number;
  succeededCount: number;
  failedCount: number;
  rollupStatus: string;
};

export type InvocationSummary = {
  jobId: string;
  status: string;
  semanticStatus: string | null;
  agentId: string;
  outcomeSummary: string | null;
  enqueuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  dataQueueAttempts: number | null;
  dataQueueMaxAttempts: number | null;
};

type StepExecutionSummarySource = {
  pipelineStepId: string;
  expectedInvocationCount: number;
  succeededCount: number;
  failedCount: number;
  rollupStatus: string;
  pipelineStep: { order: number; agentId: string; agentVersion: string };
};

type InvocationSummarySource = Omit<InvocationSummary, "outcomeSummary"> & {
  error: unknown;
  agentResponse: unknown;
};

export const toExecutionSummary = (
  execution: ExecutionSummary,
): ExecutionSummary => ({
  id: execution.id,
  executionTime: execution.executionTime,
  enqueueStatus: execution.enqueueStatus,
  runStatus: execution.runStatus,
  effectiveExecutionConfig: execution.effectiveExecutionConfig,
  jobsCreated: execution.jobsCreated,
  jobsEnqueued: execution.jobsEnqueued,
  succeededInvocationCount: execution.succeededInvocationCount,
  failedInvocationCount: execution.failedInvocationCount,
  errors: execution.errors,
  metadata: execution.metadata,
  createdAt: execution.createdAt,
});

export const toStepExecutionSummaries = (
  stepExecutions: StepExecutionSummarySource[],
): StepExecutionSummary[] =>
  stepExecutions
    .map((stepExecution) => ({
      pipelineStepId: stepExecution.pipelineStepId,
      stepOrder: stepExecution.pipelineStep.order,
      agentId: stepExecution.pipelineStep.agentId,
      agentVersion: stepExecution.pipelineStep.agentVersion,
      expectedInvocationCount: stepExecution.expectedInvocationCount,
      succeededCount: stepExecution.succeededCount,
      failedCount: stepExecution.failedCount,
      rollupStatus: stepExecution.rollupStatus,
    }))
    .sort((left, right) => left.stepOrder - right.stepOrder);

export const toInvocationSummary = (
  job: InvocationSummarySource,
): InvocationSummary => {
  const outcomeSummary = formatInvocationOutcomeSummary(
    job.error,
    job.agentResponse,
  );

  return {
    jobId: job.jobId,
    status: job.status,
    semanticStatus: job.semanticStatus,
    agentId: job.agentId,
    outcomeSummary,
    enqueuedAt: job.enqueuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    dataQueueAttempts: job.dataQueueAttempts,
    dataQueueMaxAttempts: job.dataQueueMaxAttempts,
  };
};
