import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";

import {
  computePipelineWallElapsed,
  formatPipelineElapsedLabel,
} from "./compute-execution-elapsed";

type Db = typeof prisma;

export type PipelineExecutionSource = "manual" | "schedule" | "http-trigger";

export type PipelineExecutionRow = {
  id: string;
  source: PipelineExecutionSource;
  sourceId: string;
  executionTime: Date;
  enqueueStatus: string;
  runStatus: string;
  jobsCreated: number;
  jobsEnqueued: number;
  succeededInvocationCount: number;
  failedInvocationCount: number;
  errors: unknown;
  createdAt: Date;
  /** Wall-clock elapsed label for this execution (derived from job rows). */
  elapsedLabel: string;
};

export type PipelineExecutionsPageResult = {
  executions: PipelineExecutionRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Loads a unified execution history for a pipeline across schedule, HTTP trigger, and manual sources.
 *
 * @param pipelineId - Pipeline id.
 * @param page - 1-based page number.
 * @param pageSize - Requested page size.
 * @param db - Prisma client dependency.
 * @returns Merged and paginated execution rows sorted by execution time descending.
 */
export const getPipelineExecutionsPage = async (
  pipelineId: string,
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<PipelineExecutionsPageResult> => {
  const scheduleArgs = {
    where: { schedule: { pipelineId } },
    orderBy: { executionTime: "desc" },
    select: {
      id: true,
      executionTime: true,
      enqueueStatus: true,
      runStatus: true,
      jobsCreated: true,
      jobsEnqueued: true,
      succeededInvocationCount: true,
      failedInvocationCount: true,
      errors: true,
      createdAt: true,
      schedule: { select: { id: true } },
    },
  } satisfies Prisma.ScheduleExecutionFindManyArgs;
  const httpTriggerArgs = {
    where: { httpTrigger: { pipelineId } },
    orderBy: { executionTime: "desc" },
    select: {
      id: true,
      executionTime: true,
      enqueueStatus: true,
      runStatus: true,
      jobsCreated: true,
      jobsEnqueued: true,
      succeededInvocationCount: true,
      failedInvocationCount: true,
      errors: true,
      createdAt: true,
      httpTrigger: { select: { id: true } },
    },
  } satisfies Prisma.HttpTriggerExecutionFindManyArgs;
  const manualArgs = {
    where: { pipelineId },
    orderBy: { executionTime: "desc" },
    select: {
      id: true,
      pipelineId: true,
      executionTime: true,
      enqueueStatus: true,
      runStatus: true,
      jobsCreated: true,
      jobsEnqueued: true,
      succeededInvocationCount: true,
      failedInvocationCount: true,
      errors: true,
      createdAt: true,
    },
  } satisfies Prisma.ManualPipelineExecutionFindManyArgs;

  const [scheduleRows, httpTriggerRows, manualRows] = await Promise.all([
    db.scheduleExecution.findMany(scheduleArgs),
    db.httpTriggerExecution.findMany(httpTriggerArgs),
    db.manualPipelineExecution.findMany(manualArgs),
  ]);

  const merged: Array<Omit<PipelineExecutionRow, "elapsedLabel">> = [
    ...scheduleRows.map((row) => ({
      id: row.id,
      source: "schedule" as const,
      sourceId: row.schedule.id,
      executionTime: row.executionTime,
      enqueueStatus: row.enqueueStatus,
      runStatus: row.runStatus,
      jobsCreated: row.jobsCreated,
      jobsEnqueued: row.jobsEnqueued,
      succeededInvocationCount: row.succeededInvocationCount,
      failedInvocationCount: row.failedInvocationCount,
      errors: row.errors,
      createdAt: row.createdAt,
    })),
    ...httpTriggerRows.map((row) => ({
      id: row.id,
      source: "http-trigger" as const,
      sourceId: row.httpTrigger.id,
      executionTime: row.executionTime,
      enqueueStatus: row.enqueueStatus,
      runStatus: row.runStatus,
      jobsCreated: row.jobsCreated,
      jobsEnqueued: row.jobsEnqueued,
      succeededInvocationCount: row.succeededInvocationCount,
      failedInvocationCount: row.failedInvocationCount,
      errors: row.errors,
      createdAt: row.createdAt,
    })),
    ...manualRows.map((row) => ({
      id: row.id,
      source: "manual" as const,
      sourceId: row.pipelineId,
      executionTime: row.executionTime,
      enqueueStatus: row.enqueueStatus,
      runStatus: row.runStatus,
      jobsCreated: row.jobsCreated,
      jobsEnqueued: row.jobsEnqueued,
      succeededInvocationCount: row.succeededInvocationCount,
      failedInvocationCount: row.failedInvocationCount,
      errors: row.errors,
      createdAt: row.createdAt,
    })),
  ].sort(
    (left, right) =>
      right.executionTime.getTime() - left.executionTime.getTime(),
  );

  const start = Math.max(0, (page - 1) * pageSize);
  const end = start + pageSize;
  const slice = merged.slice(start, end);
  const executionsWithElapsed = await attachPipelineExecutionElapsedLabels(
    slice,
    db,
  );

  return {
    executions: executionsWithElapsed,
    total: merged.length,
    page,
    pageSize,
  };
};

/**
 * Groups agent jobs by execution id for pipeline execution list rows.
 *
 * @param rows - One page of merged execution rows (no id collisions across sources).
 * @param jobs - Job rows from Prisma for those executions only.
 * @returns Map from `source:id` to invocation inputs for {@link computePipelineWallElapsed}.
 */
const groupJobsByPipelineExecutionRow = (
  rows: Array<Pick<PipelineExecutionRow, "id" | "source" | "runStatus">>,
  jobs: Array<{
    scheduleExecutionId: string | null;
    httpTriggerExecutionId: string | null;
    manualExecutionId: string | null;
    enqueuedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
  }>,
): Map<
  string,
  Array<{ enqueuedAt: Date; startedAt: Date | null; completedAt: Date | null }>
> => {
  const map = new Map<
    string,
    Array<{
      enqueuedAt: Date;
      startedAt: Date | null;
      completedAt: Date | null;
    }>
  >();
  const keyForRow = (source: PipelineExecutionSource, id: string) =>
    `${source}:${id}`;

  for (const row of rows) {
    map.set(keyForRow(row.source, row.id), []);
  }

  for (const job of jobs) {
    let key: string | null = null;
    if (job.scheduleExecutionId != null) {
      key = keyForRow("schedule", job.scheduleExecutionId);
    } else if (job.httpTriggerExecutionId != null) {
      key = keyForRow("http-trigger", job.httpTriggerExecutionId);
    } else if (job.manualExecutionId != null) {
      key = keyForRow("manual", job.manualExecutionId);
    }
    if (key == null || !map.has(key)) {
      continue;
    }
    const list = map.get(key);
    if (list) {
      list.push({
        enqueuedAt: job.enqueuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      });
    }
  }

  return map;
};

/**
 * Fetches job timestamps for the current page and attaches formatted elapsed labels.
 *
 * @param slice - Paginated execution rows (still without elapsed).
 * @param db - Prisma client.
 * @returns Rows including {@link PipelineExecutionRow.elapsedLabel}.
 */
const attachPipelineExecutionElapsedLabels = async (
  slice: Array<Omit<PipelineExecutionRow, "elapsedLabel">>,
  db: Db,
): Promise<PipelineExecutionRow[]> => {
  const now = new Date();
  if (slice.length === 0) {
    return [];
  }

  const scheduleIds = slice
    .filter((row) => row.source === "schedule")
    .map((row) => row.id);
  const httpIds = slice
    .filter((row) => row.source === "http-trigger")
    .map((row) => row.id);
  const manualIds = slice
    .filter((row) => row.source === "manual")
    .map((row) => row.id);

  const or: Prisma.AgentJobExecutionWhereInput[] = [];
  if (scheduleIds.length > 0) {
    or.push({ scheduleExecutionId: { in: scheduleIds } });
  }
  if (httpIds.length > 0) {
    or.push({ httpTriggerExecutionId: { in: httpIds } });
  }
  if (manualIds.length > 0) {
    or.push({ manualExecutionId: { in: manualIds } });
  }

  const jobs =
    or.length === 0
      ? []
      : await db.agentJobExecution.findMany({
          where: { OR: or },
          select: {
            scheduleExecutionId: true,
            httpTriggerExecutionId: true,
            manualExecutionId: true,
            enqueuedAt: true,
            startedAt: true,
            completedAt: true,
          },
        });

  const grouped = groupJobsByPipelineExecutionRow(slice, jobs);

  return slice.map((row) => {
    const key = `${row.source}:${row.id}`;
    const invocations = grouped.get(key) ?? [];
    const elapsed = computePipelineWallElapsed(invocations, row.runStatus, now);
    return {
      ...row,
      elapsedLabel: formatPipelineElapsedLabel(elapsed),
    };
  });
};

export type ManualPipelineExecutionDetail = {
  execution: {
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
  pipeline: { id: string; name: string };
  stepExecutions: Array<{
    pipelineStepId: string;
    stepOrder: number;
    agentId: string;
    agentVersion: string;
    expectedInvocationCount: number;
    succeededCount: number;
    failedCount: number;
    rollupStatus: string;
  }>;
  invocations: Array<{
    jobId: string;
    status: string;
    agentId: string;
    pipelineStepId: string | null;
    params: unknown;
    invocationConfig: unknown | null;
    error: unknown;
    agentResponse: unknown;
    semanticStatus: string | null;
    enqueuedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    dataQueueAttempts: number | null;
    dataQueueMaxAttempts: number | null;
  }>;
};

/**
 * Loads a manual pipeline execution with per-step rollups and invocation rows.
 *
 * @param pipelineId - Pipeline id.
 * @param executionId - Manual execution id.
 * @param db - Prisma client dependency.
 * @returns Manual execution detail or null if not found.
 */
export const getManualPipelineExecutionDetail = async (
  pipelineId: string,
  executionId: string,
  db: Db = prisma,
): Promise<ManualPipelineExecutionDetail | null> => {
  const row = await db.manualPipelineExecution.findFirst({
    where: { id: executionId, pipelineId },
    include: {
      pipeline: { select: { id: true, name: true } },
      manualPipelineStepExecutions: {
        include: {
          pipelineStep: {
            select: {
              id: true,
              order: true,
              agentId: true,
              agentVersion: true,
            },
          },
        },
      },
      agentJobExecutions: {
        orderBy: { enqueuedAt: "asc" },
        select: {
          jobId: true,
          status: true,
          agentId: true,
          pipelineStepId: true,
          params: true,
          invocationConfig: true,
          error: true,
          agentResponse: true,
          semanticStatus: true,
          enqueuedAt: true,
          startedAt: true,
          completedAt: true,
          dataQueueAttempts: true,
          dataQueueMaxAttempts: true,
        },
      },
    },
  });
  if (!row) return null;

  return {
    execution: {
      id: row.id,
      executionTime: row.executionTime,
      enqueueStatus: row.enqueueStatus,
      runStatus: row.runStatus,
      effectiveExecutionConfig: row.effectiveExecutionConfig,
      jobsCreated: row.jobsCreated,
      jobsEnqueued: row.jobsEnqueued,
      succeededInvocationCount: row.succeededInvocationCount,
      failedInvocationCount: row.failedInvocationCount,
      errors: row.errors,
      metadata: row.metadata,
      createdAt: row.createdAt,
    },
    pipeline: row.pipeline,
    stepExecutions: row.manualPipelineStepExecutions
      .map((item) => ({
        pipelineStepId: item.pipelineStepId,
        stepOrder: item.pipelineStep.order,
        agentId: item.pipelineStep.agentId,
        agentVersion: item.pipelineStep.agentVersion,
        expectedInvocationCount: item.expectedInvocationCount,
        succeededCount: item.succeededCount,
        failedCount: item.failedCount,
        rollupStatus: item.rollupStatus,
      }))
      .sort((left, right) => left.stepOrder - right.stepOrder),
    invocations: row.agentJobExecutions.map((job) => ({
      jobId: job.jobId,
      status: job.status,
      agentId: job.agentId,
      pipelineStepId: job.pipelineStepId,
      params: job.params,
      invocationConfig: job.invocationConfig,
      error: job.error,
      agentResponse: job.agentResponse,
      semanticStatus: job.semanticStatus,
      enqueuedAt: job.enqueuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      dataQueueAttempts: job.dataQueueAttempts,
      dataQueueMaxAttempts: job.dataQueueMaxAttempts,
    })),
  };
};
