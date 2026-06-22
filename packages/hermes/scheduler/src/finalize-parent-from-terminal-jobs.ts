import {
  AgentJobExecutionStatus,
  type Prisma,
  ScheduleRunStatus,
} from "@hermes/orchestration-database";

import { resolveRunStatusForSettledCancelledExecution } from "./cancel-execution";

/** Agent job row shape used to decide parent execution finalization. */
export type TerminalJobRow = {
  status: AgentJobExecutionStatus;
  error: Prisma.JsonValue | null;
};

const TERMINAL_JOB_STATUSES = new Set<AgentJobExecutionStatus>([
  AgentJobExecutionStatus.completed,
  AgentJobExecutionStatus.failed,
  AgentJobExecutionStatus.cancelled,
]);

/**
 * Returns true when every job is terminal and at least one job exists.
 *
 * @param jobs - Agent job rows for one parent execution.
 */
export const areAllAgentJobsTerminal = (
  jobs: Array<{ status: AgentJobExecutionStatus }>,
): boolean =>
  jobs.length > 0 && jobs.every((job) => TERMINAL_JOB_STATUSES.has(job.status));

/**
 * Derives the parent execution run status from terminal agent jobs (legacy rows without step rollups).
 *
 * @param jobs - Terminal agent job rows for the parent execution.
 * @returns Resolved parent {@link ScheduleRunStatus}.
 */
export const resolveRunStatusFromTerminalJobs = (
  jobs: TerminalJobRow[],
): ScheduleRunStatus => resolveRunStatusForSettledCancelledExecution(jobs);

/**
 * Counts succeeded vs failed invocations from terminal agent jobs for parent row sync.
 *
 * @param jobs - Terminal agent job rows for the parent execution.
 */
export const countInvocationOutcomesFromTerminalJobs = (
  jobs: TerminalJobRow[],
): {
  succeededInvocationCount: number;
  failedInvocationCount: number;
} => ({
  succeededInvocationCount: jobs.filter(
    (job) => job.status === AgentJobExecutionStatus.completed,
  ).length,
  failedInvocationCount: jobs.filter(
    (job) => job.status !== AgentJobExecutionStatus.completed,
  ).length,
});

/**
 * Resolves a parent run status when step rollup rows are absent but all agent jobs are terminal.
 *
 * @param jobs - Agent job rows for the parent execution.
 * @returns Parent run status, or null when jobs are not all terminal.
 */
export const resolveParentRunStatusWhenStepRowsMissing = (
  jobs: TerminalJobRow[],
): ScheduleRunStatus | null => {
  if (!areAllAgentJobsTerminal(jobs)) {
    return null;
  }
  return resolveRunStatusFromTerminalJobs(jobs);
};
