import type { Prisma } from "@hermes/orchestration-database";
import { prisma } from "@hermes/orchestration-database";
import { parseEffectiveExecutionConfig } from "@hermes/scheduler/execution-config";
import { computeStepRollupFromCounts } from "@hermes/scheduler/schedule-rollup";

import {
  computePipelineWallElapsed,
  formatPipelineElapsedLabel,
} from "./compute-execution-elapsed";
import {
  executionSummarySelect,
  invocationSummarySelect,
  stepExecutionSummarySelect,
  toExecutionSummary,
  toInvocationSummary,
  toStepExecutionSummaries,
  type ExecutionSummary,
  type InvocationSummary,
} from "./execution-summary";

type Db = typeof prisma;

const MAX_EXECUTIONS_PER_SOURCE = 1000;

export type PipelineExecutionSource = "manual" | "schedule" | "http-trigger";

export type PipelineExecutionRow = {
  id: string;
  source: PipelineExecutionSource;
  sourceId: string;
  sourceName: string | null;
  executionTime: Date;
  enqueueStatus: string;
  runStatus: string;
  jobsCreated: number;
  jobsEnqueued: number;
  succeededInvocationCount: number;
  failedInvocationCount: number;
  createdAt: Date;
  elapsedLabel: string;
};

export type PipelineExecutionsPageResult = {
  executions: PipelineExecutionRow[];
  total: number;
  page: number;
  pageSize: number;
};

type PipelineExecutionListRow = Omit<PipelineExecutionRow, "elapsedLabel">;

type ExecutionListFields = Omit<
  PipelineExecutionListRow,
  "source" | "sourceId" | "sourceName"
>;

type PipelineExecutionSourcePage = {
  rows: PipelineExecutionListRow[];
  total: number;
};

const executionListSelect = {
  id: true,
  executionTime: true,
  enqueueStatus: true,
  runStatus: true,
  jobsCreated: true,
  jobsEnqueued: true,
  succeededInvocationCount: true,
  failedInvocationCount: true,
  createdAt: true,
} as const;

const toPipelineExecutionListRow = (
  execution: ExecutionListFields,
  source: PipelineExecutionSource,
  sourceId: string,
  sourceName: string | null,
): PipelineExecutionListRow => ({
  id: execution.id,
  source,
  sourceId,
  sourceName,
  executionTime: execution.executionTime,
  enqueueStatus: execution.enqueueStatus,
  runStatus: execution.runStatus,
  jobsCreated: execution.jobsCreated,
  jobsEnqueued: execution.jobsEnqueued,
  succeededInvocationCount: execution.succeededInvocationCount,
  failedInvocationCount: execution.failedInvocationCount,
  createdAt: execution.createdAt,
});

const compareNewestExecutionFirst = (
  left: PipelineExecutionListRow,
  right: PipelineExecutionListRow,
): number => {
  const executionTimeDifference =
    right.executionTime.getTime() - left.executionTime.getTime();
  if (executionTimeDifference !== 0) {
    return executionTimeDifference;
  }
  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? 1 : -1;
};

const loadNewestExecutionsPerParent = async <Execution>(
  parentIds: string[],
  loadNewestForParent: (parentId: string) => Promise<Execution[]>,
  countForParents: (parentIds: string[]) => Promise<number>,
): Promise<{ executions: Execution[]; total: number }> => {
  if (parentIds.length === 0) {
    return { executions: [], total: 0 };
  }
  const [executionsPerParent, total] = await Promise.all([
    Promise.all(parentIds.map((parentId) => loadNewestForParent(parentId))),
    countForParents(parentIds),
  ]);

  return { executions: executionsPerParent.flat(), total };
};

const loadScheduleExecutionsForPipeline = async (
  pipelineId: string,
  take: number,
  db: Db,
): Promise<PipelineExecutionSourcePage> => {
  const schedulesQuery = {
    where: { pipelineId },
    select: { id: true, name: true },
  } satisfies Prisma.ScheduleFindManyArgs;
  const schedules = await db.schedule.findMany(schedulesQuery);
  const scheduleIds = schedules.map((schedule) => schedule.id);
  const scheduleNameById = new Map(
    schedules.map((schedule) => [schedule.id, schedule.name]),
  );
  const { executions, total } = await loadNewestExecutionsPerParent(
    scheduleIds,
    (scheduleId) => {
      const executionsQuery = {
        where: { scheduleId },
        orderBy: [{ executionTime: "desc" }, { id: "desc" }],
        take,
        select: { ...executionListSelect, scheduleId: true },
      } satisfies Prisma.ScheduleExecutionFindManyArgs;

      return db.scheduleExecution.findMany(executionsQuery);
    },
    (parentIds) => {
      const countQuery = {
        where: { scheduleId: { in: parentIds } },
      } satisfies Prisma.ScheduleExecutionCountArgs;

      return db.scheduleExecution.count(countQuery);
    },
  );
  const rows = executions.map((execution) => {
    const scheduleName = scheduleNameById.get(execution.scheduleId) ?? null;

    return toPipelineExecutionListRow(
      execution,
      "schedule",
      execution.scheduleId,
      scheduleName,
    );
  });

  return { rows, total };
};

const loadHttpTriggerExecutionsForPipeline = async (
  pipelineId: string,
  take: number,
  db: Db,
): Promise<PipelineExecutionSourcePage> => {
  const httpTriggersQuery = {
    where: { pipelineId },
    select: { id: true, name: true },
  } satisfies Prisma.HttpTriggerFindManyArgs;
  const httpTriggers = await db.httpTrigger.findMany(httpTriggersQuery);
  const httpTriggerIds = httpTriggers.map((httpTrigger) => httpTrigger.id);
  const httpTriggerNameById = new Map(
    httpTriggers.map((httpTrigger) => [httpTrigger.id, httpTrigger.name]),
  );
  const { executions, total } = await loadNewestExecutionsPerParent(
    httpTriggerIds,
    (httpTriggerId) => {
      const executionsQuery = {
        where: { httpTriggerId },
        orderBy: [{ executionTime: "desc" }, { id: "desc" }],
        take,
        select: { ...executionListSelect, httpTriggerId: true },
      } satisfies Prisma.HttpTriggerExecutionFindManyArgs;

      return db.httpTriggerExecution.findMany(executionsQuery);
    },
    (parentIds) => {
      const countQuery = {
        where: { httpTriggerId: { in: parentIds } },
      } satisfies Prisma.HttpTriggerExecutionCountArgs;

      return db.httpTriggerExecution.count(countQuery);
    },
  );
  const rows = executions.map((execution) => {
    const httpTriggerName =
      httpTriggerNameById.get(execution.httpTriggerId) ?? null;

    return toPipelineExecutionListRow(
      execution,
      "http-trigger",
      execution.httpTriggerId,
      httpTriggerName,
    );
  });

  return { rows, total };
};

const loadManualExecutionsForPipeline = async (
  pipelineId: string,
  take: number,
  db: Db,
): Promise<PipelineExecutionSourcePage> => {
  const executionsQuery = {
    where: { pipelineId },
    orderBy: [{ executionTime: "desc" }, { id: "desc" }],
    take,
    select: executionListSelect,
  } satisfies Prisma.ManualPipelineExecutionFindManyArgs;
  const countQuery = {
    where: { pipelineId },
  } satisfies Prisma.ManualPipelineExecutionCountArgs;
  const [executions, total] = await Promise.all([
    db.manualPipelineExecution.findMany(executionsQuery),
    db.manualPipelineExecution.count(countQuery),
  ]);
  const rows = executions.map((execution) =>
    toPipelineExecutionListRow(execution, "manual", pipelineId, null),
  );

  return { rows, total };
};

export const getPipelineExecutionsPage = async (
  pipelineId: string,
  page: number,
  pageSize: number,
  db: Db = prisma,
): Promise<PipelineExecutionsPageResult> => {
  const lastReachablePage = Math.max(
    1,
    Math.floor(MAX_EXECUTIONS_PER_SOURCE / pageSize),
  );
  const clampedPage = Math.min(Math.max(1, page), lastReachablePage);
  const take = Math.min(clampedPage * pageSize, MAX_EXECUTIONS_PER_SOURCE);
  const [scheduleExecutions, httpTriggerExecutions, manualExecutions] =
    await Promise.all([
      loadScheduleExecutionsForPipeline(pipelineId, take, db),
      loadHttpTriggerExecutionsForPipeline(pipelineId, take, db),
      loadManualExecutionsForPipeline(pipelineId, take, db),
    ]);
  const merged = [
    ...scheduleExecutions.rows,
    ...httpTriggerExecutions.rows,
    ...manualExecutions.rows,
  ].sort(compareNewestExecutionFirst);
  const start = (clampedPage - 1) * pageSize;
  const pageRows = merged.slice(start, start + pageSize);
  const executionsWithElapsed = await attachExecutionElapsedLabels(
    pageRows,
    db,
  );
  const total =
    scheduleExecutions.total +
    httpTriggerExecutions.total +
    manualExecutions.total;

  return {
    executions: executionsWithElapsed,
    total,
    page: clampedPage,
    pageSize,
  };
};

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

type ElapsedLabelSourceRow = Pick<
  PipelineExecutionRow,
  "id" | "source" | "runStatus"
>;

export const attachExecutionElapsedLabels = async <
  Row extends ElapsedLabelSourceRow,
>(
  slice: Row[],
  db: { agentJobExecution: Pick<Db["agentJobExecution"], "findMany"> },
): Promise<Array<Row & { elapsedLabel: string }>> => {
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

type AgentJobStatusLite = {
  status: string;
  pipelineStepId: string | null;
};

const loadExecutionConfigForManualDetail = (
  raw: unknown,
): ReturnType<typeof parseEffectiveExecutionConfig> => {
  try {
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      return parseEffectiveExecutionConfig(raw as Record<string, unknown>);
    }
  } catch {
    // Invalid config JSON — fall back to defaults.
  }
  return parseEffectiveExecutionConfig({});
};

const deriveManualInvocationCountsFromJobs = (
  jobs: ReadonlyArray<{ status: string }>,
): { succeededInvocationCount: number; failedInvocationCount: number } => {
  let succeededInvocationCount = 0;
  let failedInvocationCount = 0;
  for (const job of jobs) {
    if (job.status === "completed") {
      succeededInvocationCount += 1;
    } else if (job.status === "failed") {
      failedInvocationCount += 1;
    }
  }
  return { succeededInvocationCount, failedInvocationCount };
};

const deriveManualStepExecutionsFromJobs = <
  T extends {
    pipelineStepId: string;
    expectedInvocationCount: number;
    succeededCount: number;
    failedCount: number;
    rollupStatus: string;
  },
>(
  steps: T[],
  jobs: ReadonlyArray<AgentJobStatusLite>,
  stepRollupPolicy: ReturnType<
    typeof parseEffectiveExecutionConfig
  >["stepRollupPolicy"],
): T[] => {
  return steps.map((step) => {
    const forStep = jobs.filter(
      (j) => j.pipelineStepId === step.pipelineStepId,
    );
    const succeededCount = forStep.filter(
      (j) => j.status === "completed",
    ).length;
    const failedCount = forStep.filter((j) => j.status === "failed").length;
    const hasNonTerminal = forStep.some(
      (j) => j.status === "pending" || j.status === "running",
    );
    if (hasNonTerminal) {
      return {
        ...step,
        succeededCount,
        failedCount,
        rollupStatus: "running",
      };
    }
    const terminal = computeStepRollupFromCounts(
      succeededCount,
      failedCount,
      stepRollupPolicy,
    );
    return {
      ...step,
      succeededCount,
      failedCount,
      rollupStatus: terminal,
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

  const executionConfig = loadExecutionConfigForManualDetail(
    row.effectiveExecutionConfig,
  );
  const jobRows = row.agentJobExecutions;
  const { succeededInvocationCount, failedInvocationCount } =
    deriveManualInvocationCountsFromJobs(jobRows);

  const stepExecutionsBase = row.manualPipelineStepExecutions
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
    .sort((left, right) => left.stepOrder - right.stepOrder);

  const stepExecutions = deriveManualStepExecutionsFromJobs(
    stepExecutionsBase,
    jobRows,
    executionConfig.stepRollupPolicy,
  );

  return {
    execution: {
      id: row.id,
      executionTime: row.executionTime,
      enqueueStatus: row.enqueueStatus,
      runStatus: row.runStatus,
      effectiveExecutionConfig: row.effectiveExecutionConfig,
      jobsCreated: row.jobsCreated,
      jobsEnqueued: row.jobsEnqueued,
      succeededInvocationCount,
      failedInvocationCount,
      errors: row.errors,
      metadata: row.metadata,
      createdAt: row.createdAt,
    },
    pipeline: row.pipeline,
    stepExecutions,
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

export type ManualPipelineExecutionSummary = Omit<
  ManualPipelineExecutionDetail,
  "execution" | "invocations"
> & {
  execution: ExecutionSummary;
  invocations: InvocationSummary[];
};

export const getManualPipelineExecutionSummary = async (
  pipelineId: string,
  executionId: string,
  db: Db = prisma,
): Promise<ManualPipelineExecutionSummary | null> => {
  const summaryQuery = {
    where: { id: executionId, pipelineId },
    select: {
      ...executionSummarySelect,
      runParams: true,
      pipeline: { select: { id: true, name: true } },
      manualPipelineStepExecutions: { select: stepExecutionSummarySelect },
      agentJobExecutions: {
        orderBy: { enqueuedAt: "asc" },
        select: { ...invocationSummarySelect, pipelineStepId: true },
      },
    },
  } satisfies Prisma.ManualPipelineExecutionFindFirstArgs;
  const row = await db.manualPipelineExecution.findFirst(summaryQuery);
  if (!row) {
    return null;
  }
  const executionConfig = loadExecutionConfigForManualDetail(
    row.effectiveExecutionConfig,
  );
  const { succeededInvocationCount, failedInvocationCount } =
    deriveManualInvocationCountsFromJobs(row.agentJobExecutions);
  const stepExecutions = deriveManualStepExecutionsFromJobs(
    toStepExecutionSummaries(row.manualPipelineStepExecutions),
    row.agentJobExecutions,
    executionConfig.stepRollupPolicy,
  );
  const execution = toExecutionSummary(row);

  return {
    execution: {
      ...execution,
      succeededInvocationCount,
      failedInvocationCount,
    },
    pipeline: row.pipeline,
    stepExecutions,
    invocations: row.agentJobExecutions.map(toInvocationSummary),
  };
};
